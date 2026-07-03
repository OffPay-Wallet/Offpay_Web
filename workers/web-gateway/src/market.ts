import { z } from "zod";

import type {
  MarketHistoricalPriceInterval,
  MarketHistoricalUsdPricePoint,
  MarketPriceIdentifier,
  MarketTokenPricesBatchResponse,
  SolanaCluster,
} from "../../../src/lib/offpay/types";
import type { GatewayEnv } from "./types";

const alchemySolanaMainnetNetwork = "solana-mainnet";
const nativeSolMint = "So11111111111111111111111111111111111111112";
const alchemyPricesTimeoutMs = 12_000;
const tokenPriceBatchConcurrency = 6;
const usdStablePriceSymbols = new Set(["USDC", "USDT", "DUSDC", "DUSDT"]);
const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]+$/;

type AlchemyPricesConfig = {
  apiKey: string;
  origin: string;
};

type AlchemyPricesAuthMode = "path-key" | "bearer";

export const marketPriceIdentifierSchema = z.union([
  z.object({
    type: z.literal("symbol"),
    symbol: z.string().trim().min(1).max(24),
  }),
  z.object({
    type: z.literal("address"),
    network: z.string().trim().min(1).max(64),
    address: z.string().trim().min(1).max(128),
  }),
]);

export const marketTokenPriceBodySchema = z.object({
  identifier: marketPriceIdentifierSchema,
  network: z.enum(["solana:devnet", "solana:testnet", "solana:mainnet"]),
});

export const marketTokenPriceBatchBodySchema = z.object({
  currency: z.literal("USD"),
  network: z.enum(["solana:devnet", "solana:testnet", "solana:mainnet"]),
  tokens: z
    .array(
      z.object({
        mint: z.string().trim().min(1).max(128),
        symbol: z.string().trim().min(1).max(24),
        priceSymbol: z.string().trim().min(1).max(24),
      }),
    )
    .min(1)
    .max(80),
});

export const marketTokenPriceHistoryBodySchema = z.object({
  identifier: marketPriceIdentifierSchema,
  network: z.enum(["solana:devnet", "solana:testnet", "solana:mainnet"]),
  startTime: z.string().trim().min(1).max(64),
  endTime: z.string().trim().min(1).max(64),
  interval: z.enum(["5m", "1h", "1d"]),
  withMarketData: z.boolean().optional(),
});

export class MarketGatewayError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor({
    code,
    details,
    message,
    status,
  }: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, unknown>;
  }) {
    super(message);
    this.name = "MarketGatewayError";
    this.code = code;
    this.status = status;

    if (details) {
      this.details = details;
    }
  }
}

function configuredHttpsUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString().replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
}

function requiredAlchemyConfig(env: GatewayEnv): AlchemyPricesConfig {
  const origin = configuredHttpsUrl(env.ALCHEMY_PRICE_API_ORIGIN);
  const apiKey = env.ALCHEMY_PRICE_API_KEY?.trim();

  if (!origin || !apiKey) {
    throw new MarketGatewayError({
      code: "market_config_missing",
      message: "Alchemy pricing is not configured for the Web Gateway.",
      status: 503,
      details: {
        expectedKeys: ["ALCHEMY_PRICE_API_ORIGIN", "ALCHEMY_PRICE_API_KEY"],
      },
    });
  }

  return { apiKey, origin };
}

function buildAlchemyPricesUrl(
  config: AlchemyPricesConfig,
  path: `/${string}`,
  authMode: AlchemyPricesAuthMode,
): string {
  if (authMode === "bearer") {
    return `${config.origin}${path}`;
  }

  return `${config.origin}/${encodeURIComponent(config.apiKey)}${path}`;
}

function readErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload == null || Array.isArray(payload)) {
    return null;
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (typeof error !== "object" || error == null || Array.isArray(error)) {
    return null;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : null;
}

async function fetchAlchemyJson(
  env: GatewayEnv,
  path: `/${string}`,
  init: RequestInit,
): Promise<unknown> {
  const config = requiredAlchemyConfig(env);
  const authModes: AlchemyPricesAuthMode[] = ["path-key", "bearer"];
  let lastGatewayError: MarketGatewayError | null = null;

  for (const authMode of authModes) {
    try {
      return await fetchAlchemyJsonWithAuthMode(config, path, init, authMode);
    } catch (error) {
      if (error instanceof MarketGatewayError) {
        lastGatewayError = error;
        if (error.status === 429) {
          throw error;
        }
        continue;
      }

      throw error;
    }
  }

  if (lastGatewayError) {
    throw lastGatewayError;
  }

  throw new MarketGatewayError({
    code: "upstream_unavailable",
    message: "Alchemy Prices is temporarily unavailable.",
    status: 503,
  });
}

async function fetchAlchemyJsonWithAuthMode(
  config: AlchemyPricesConfig,
  path: `/${string}`,
  init: RequestInit,
  authMode: AlchemyPricesAuthMode,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(
      new Error(`Alchemy Prices request timed out after ${alchemyPricesTimeoutMs}ms`),
    );
  }, alchemyPricesTimeoutMs);

  try {
    const headers = new Headers(init.headers);
    if (authMode === "bearer") {
      headers.set("authorization", `Bearer ${config.apiKey}`);
    }

    const response = await fetch(buildAlchemyPricesUrl(config, path, authMode), {
      ...init,
      headers,
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new MarketGatewayError({
        code:
          response.status === 404
            ? "not_found"
            : response.status === 429
              ? "rate_limited"
              : "upstream_unavailable",
        message:
          readErrorMessage(payload) ??
          `Alchemy Prices request failed with ${response.status}.`,
        status: response.status === 404 ? 404 : response.status === 429 ? 429 : 502,
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof MarketGatewayError) {
      throw error;
    }

    throw new MarketGatewayError({
      code: "upstream_unavailable",
      message: "Alchemy Prices is temporarily unavailable.",
      status: 503,
    });
  } finally {
    clearTimeout(timer);
  }
}

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readUsdPrice(prices: unknown): { value: number; lastUpdatedAt: string } | null {
  if (!Array.isArray(prices)) {
    return null;
  }

  for (const item of prices) {
    if (typeof item !== "object" || item == null || Array.isArray(item)) continue;
    const currency = (item as { currency?: unknown }).currency;
    if (typeof currency !== "string" || currency.trim().toUpperCase() !== "USD") continue;
    const value = parsePositiveNumber((item as { value?: unknown }).value);
    const lastUpdatedAt = (item as { lastUpdatedAt?: unknown }).lastUpdatedAt;
    if (value == null || typeof lastUpdatedAt !== "string" || !lastUpdatedAt.trim()) {
      continue;
    }

    return { value, lastUpdatedAt };
  }

  return null;
}

function readFirstDataItem(payload: unknown): Record<string, unknown> | null {
  if (typeof payload !== "object" || payload == null || Array.isArray(payload)) {
    return null;
  }

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    return null;
  }

  const firstItem = data[0];
  if (typeof firstItem !== "object" || firstItem == null || Array.isArray(firstItem)) {
    return null;
  }

  return firstItem as Record<string, unknown>;
}

export async function fetchMarketTokenUsdPrice(
  env: GatewayEnv,
  identifier: MarketPriceIdentifier,
): Promise<{ value: number; lastUpdatedAt: string } | null> {
  try {
    const payload =
      identifier.type === "symbol"
        ? await fetchAlchemyJson(
            env,
            `/tokens/by-symbol?symbols=${encodeURIComponent(identifier.symbol)}`,
            { method: "GET", headers: { accept: "application/json" } },
          )
        : await fetchAlchemyJson(env, "/tokens/by-address", {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              addresses: [{ network: identifier.network, address: identifier.address }],
            }),
          });

    const dataItem = readFirstDataItem(payload);
    if (dataItem == null || typeof dataItem.error === "string") {
      return null;
    }

    return readUsdPrice(dataItem.prices);
  } catch (error) {
    if (error instanceof MarketGatewayError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

function readHistoricalPricePoints(payload: unknown): MarketHistoricalUsdPricePoint[] {
  if (typeof payload !== "object" || payload == null || Array.isArray(payload)) {
    return [];
  }

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      if (typeof item !== "object" || item == null || Array.isArray(item)) {
        return null;
      }

      const value = parsePositiveNumber((item as { value?: unknown }).value);
      const timestampIso = (item as { timestamp?: unknown }).timestamp;
      if (value == null || typeof timestampIso !== "string" || !timestampIso.trim()) {
        return null;
      }

      const timestamp = Date.parse(timestampIso);
      if (!Number.isFinite(timestamp)) {
        return null;
      }

      return {
        value,
        timestamp,
        timestampIso,
        marketCap: parsePositiveNumber((item as { marketCap?: unknown }).marketCap),
        totalVolume: parsePositiveNumber((item as { totalVolume?: unknown }).totalVolume),
      };
    })
    .filter((item): item is MarketHistoricalUsdPricePoint => item != null)
    .sort((left, right) => left.timestamp - right.timestamp);
}

export async function fetchMarketTokenUsdPriceHistory(
  env: GatewayEnv,
  identifier: MarketPriceIdentifier,
  params: {
    startTime: string;
    endTime: string;
    interval: MarketHistoricalPriceInterval;
    withMarketData?: boolean;
  },
): Promise<MarketHistoricalUsdPricePoint[]> {
  try {
    const payload = await fetchAlchemyJson(env, "/tokens/historical", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...(identifier.type === "symbol"
          ? { symbol: identifier.symbol }
          : { network: identifier.network, address: identifier.address }),
        startTime: params.startTime,
        endTime: params.endTime,
        interval: params.interval,
        withMarketData: params.withMarketData ?? false,
      }),
    });

    return readHistoricalPricePoints(payload);
  } catch (error) {
    if (error instanceof MarketGatewayError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

function normalizePriceSymbol(value: string | null | undefined): string | null {
  const symbol = value?.trim().toUpperCase();
  if (!symbol) return null;
  if (symbol === "WSOL") return "SOL";
  if (symbol === "DUSDC") return "USDC";
  if (symbol === "DUSDT") return "USDT";
  return symbol;
}

function isUsdStablePriceSymbol(value: string): boolean {
  return usdStablePriceSymbols.has(value.trim().toUpperCase());
}

function isLikelySolanaAddress(value: string): boolean {
  return value.length >= 32 && value.length <= 44 && base58Pattern.test(value);
}

export function buildMarketPriceLookups(params: {
  cluster: SolanaCluster;
  mint: string;
  symbol: string;
  priceSymbol: string;
}): MarketPriceIdentifier[] {
  const mint = params.mint.trim();
  const symbol = normalizePriceSymbol(params.priceSymbol) ?? normalizePriceSymbol(params.symbol);
  const lookups: MarketPriceIdentifier[] = [];
  const seen = new Set<string>();

  const addLookup = (lookup: MarketPriceIdentifier) => {
    const key =
      lookup.type === "symbol"
        ? `symbol:${lookup.symbol}`
        : `address:${lookup.network}:${lookup.address}`;
    if (seen.has(key)) return;
    seen.add(key);
    lookups.push(lookup);
  };

  if (
    params.cluster === "solana:mainnet" &&
    mint !== nativeSolMint &&
    isLikelySolanaAddress(mint)
  ) {
    addLookup({ type: "address", network: alchemySolanaMainnetNetwork, address: mint });
  }

  if (symbol != null) {
    addLookup({ type: "symbol", symbol });
  }

  if (mint === nativeSolMint && symbol !== "SOL") {
    addLookup({ type: "symbol", symbol: "SOL" });
  }

  return lookups;
}

async function resolveTokenUsdPrice(
  env: GatewayEnv,
  cluster: SolanaCluster,
  token: { mint: string; symbol: string; priceSymbol: string },
): Promise<number | null> {
  if (isUsdStablePriceSymbol(token.priceSymbol)) {
    return 1;
  }

  const lookups = buildMarketPriceLookups({
    cluster,
    mint: token.mint,
    symbol: token.symbol,
    priceSymbol: token.priceSymbol,
  });

  for (const lookup of lookups) {
    try {
      const price = await fetchMarketTokenUsdPrice(env, lookup);
      const priceValue = parsePositiveNumber(price?.value);
      if (priceValue != null) {
        return priceValue;
      }
    } catch {
      // Try the next identifier shape before marking this token unpriced.
    }
  }

  return null;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item !== undefined) {
        results[index] = await task(item);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function uniqueTokens(
  tokens: readonly { mint: string; symbol: string; priceSymbol: string }[],
): Array<{ mint: string; symbol: string; priceSymbol: string }> {
  const seen = new Set<string>();

  return tokens.flatMap((token) => {
    const mint = token.mint.trim();
    const symbol = token.symbol.trim().toUpperCase();
    const priceSymbol = token.priceSymbol.trim().toUpperCase();
    const key = `${mint}:${symbol}:${priceSymbol}`;
    if (!mint || !symbol || !priceSymbol || seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [{ mint, symbol, priceSymbol }];
  });
}

export async function resolveMarketTokenPricesBatch(params: {
  env: GatewayEnv;
  network: SolanaCluster;
  currency: "USD";
  tokens: readonly { mint: string; symbol: string; priceSymbol: string }[];
}): Promise<MarketTokenPricesBatchResponse> {
  const tokens = uniqueTokens(params.tokens);
  const prices = await mapWithConcurrency(tokens, tokenPriceBatchConcurrency, async (token) => ({
    token,
    usdPrice: await resolveTokenUsdPrice(params.env, params.network, token),
  }));

  const unitUsdPrices: Record<string, number> = {};
  for (const result of prices) {
    const usdPrice = parsePositiveNumber(result.usdPrice);
    if (usdPrice == null) continue;
    unitUsdPrices[result.token.mint] = usdPrice;
  }

  return {
    network: params.network,
    currency: params.currency,
    rate: 1,
    fetchedAt: Date.now(),
    unitUsdPrices,
    pricedCount: Object.keys(unitUsdPrices).length,
    expectedCount: tokens.length,
  };
}
