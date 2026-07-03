import { nativeSolMeta, resolveTokenMeta } from "@/lib/offpay/tokens";
import type {
  MarketHistoricalUsdPricePoint,
  MarketPriceIdentifier,
  SolanaCluster,
  WalletPortfolio,
} from "@/lib/offpay/types";

export const nativeSolMint = "So11111111111111111111111111111111111111112";

const alchemySolanaMainnetNetwork = "solana-mainnet";
const maxHistoryPricedHoldings = 6;
const maxPortfolioHistorySamples = 160;
const usdStablePriceSymbols = new Set(["USDC", "USDT", "DUSDC", "DUSDT"]);
const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]+$/;

export type PortfolioHolding = {
  id: string;
  mint: string;
  priceMint: string;
  name: string;
  symbol: string;
  priceSymbol: string;
  balance: number;
  decimals: number;
  logo?: string | null;
  native?: boolean;
};

export type PortfolioValuation = {
  totalUsd: number;
  pricedCount: number;
  expectedCount: number;
  unitUsdPrices: Record<string, number>;
};

export type PortfolioChangeSample = {
  timestamp: number;
  usdValue: number;
};

export type PortfolioValueChange = {
  absoluteUsd: number;
  percent: number;
  tone: "positive" | "negative" | "neutral";
};

export type PortfolioHistoryInput = {
  mint: string;
  priceMint: string;
  symbol: string;
  priceSymbol: string;
  balance: number;
  stableUsdPrice: number | null;
  currentUsdPrice: number | null;
};

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function normalizeSignedZero(value: number): number {
  return Object.is(value, -0) || Math.abs(value) < Number.EPSILON * 10 ? 0 : value;
}

function isUsdStablePriceSymbol(value: string): boolean {
  return usdStablePriceSymbols.has(value.trim().toUpperCase());
}

function normalizePriceSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  if (symbol === "WSOL") return "SOL";
  if (symbol === "DUSDC") return "USDC";
  if (symbol === "DUSDT") return "USDT";
  return symbol;
}

function isLikelySolanaAddress(value: string): boolean {
  return value.length >= 32 && value.length <= 44 && base58Pattern.test(value);
}

export function buildPortfolioHoldings(
  portfolio: WalletPortfolio | undefined,
): PortfolioHolding[] {
  if (!portfolio) return [];

  const holdings: PortfolioHolding[] = [];

  if (portfolio.sol.uiAmount > 0) {
    holdings.push({
      id: `native:${nativeSolMint}`,
      mint: nativeSolMint,
      priceMint: nativeSolMint,
      name: nativeSolMeta.name,
      symbol: nativeSolMeta.symbol,
      priceSymbol: nativeSolMeta.symbol,
      balance: portfolio.sol.uiAmount,
      decimals: 9,
      native: true,
    });
  }

  for (const token of portfolio.tokens) {
    const meta = resolveTokenMeta(portfolio.cluster, token.mint);
    const balance = token.uiAmount ?? Number(token.uiAmountString);

    if (!isPositiveNumber(balance)) continue;

    const symbol = token.symbol?.trim() || meta.symbol;
    holdings.push({
      id: `${token.programId ?? "spl"}:${token.mint}`,
      mint: token.mint,
      priceMint: token.mint,
      name: token.name ?? meta.name,
      symbol,
      priceSymbol: normalizePriceSymbol(symbol),
      balance,
      decimals: token.decimals,
      ...(token.logo === undefined ? {} : { logo: token.logo }),
    });
  }

  return holdings;
}

export function buildPortfolioPriceTokens(holdings: readonly PortfolioHolding[]) {
  const seen = new Set<string>();

  return holdings.flatMap((holding) => {
    const priceMint = holding.priceMint.trim();
    const symbol = holding.symbol.trim().toUpperCase();
    const priceSymbol = normalizePriceSymbol(holding.priceSymbol);
    const key = `${priceMint}:${symbol}:${priceSymbol}`;

    if (!priceMint || !symbol || !priceSymbol || seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [
      {
        mint: priceMint,
        symbol,
        priceSymbol,
      },
    ];
  });
}

export function buildPortfolioValuation(params: {
  holdings: readonly PortfolioHolding[];
  unitUsdPrices: Readonly<Record<string, number>>;
}): PortfolioValuation {
  const uniquePriceMints = new Set<string>();
  let totalUsd = 0;
  let pricedCount = 0;

  for (const holding of params.holdings) {
    if (holding.balance <= 0) continue;
    if (uniquePriceMints.has(holding.priceMint)) continue;

    uniquePriceMints.add(holding.priceMint);
    const usdPrice = isUsdStablePriceSymbol(holding.priceSymbol)
      ? 1
      : params.unitUsdPrices[holding.priceMint];

    if (!isPositiveNumber(usdPrice)) continue;
    pricedCount += 1;
  }

  for (const holding of params.holdings) {
    if (holding.balance <= 0) continue;

    const usdPrice = isUsdStablePriceSymbol(holding.priceSymbol)
      ? 1
      : params.unitUsdPrices[holding.priceMint];

    if (!isPositiveNumber(usdPrice)) continue;
    totalUsd += holding.balance * usdPrice;
  }

  return {
    totalUsd,
    pricedCount,
    expectedCount: uniquePriceMints.size,
    unitUsdPrices: { ...params.unitUsdPrices },
  };
}

function compareByEstimatedUsdValue(
  left: PortfolioHistoryInput,
  right: PortfolioHistoryInput,
): number {
  const leftPrice = left.stableUsdPrice ?? left.currentUsdPrice ?? 0;
  const rightPrice = right.stableUsdPrice ?? right.currentUsdPrice ?? 0;
  return right.balance * rightPrice - left.balance * leftPrice;
}

export function selectPortfolioHistoryInputs(params: {
  holdings: readonly PortfolioHolding[];
  currentUnitUsdPrices?: Readonly<Record<string, number>> | null;
}): {
  inputs: PortfolioHistoryInput[];
  historyInputs: PortfolioHistoryInput[];
} {
  const byPriceMint = new Map<string, PortfolioHistoryInput>();

  for (const holding of params.holdings) {
    if (!isPositiveNumber(holding.balance)) continue;

    const priceMint = holding.priceMint.trim();
    if (!priceMint) continue;

    const priceSymbol = normalizePriceSymbol(holding.priceSymbol || holding.symbol);
    const stableUsdPrice = isUsdStablePriceSymbol(priceSymbol) ? 1 : null;
    const cachedUsdPrice = params.currentUnitUsdPrices?.[priceMint];
    const currentUsdPrice =
      stableUsdPrice ?? (isPositiveNumber(cachedUsdPrice) ? cachedUsdPrice : null);
    const existing = byPriceMint.get(priceMint);

    if (existing) {
      existing.balance += holding.balance;
      if (!isPositiveNumber(existing.currentUsdPrice) && isPositiveNumber(currentUsdPrice)) {
        existing.currentUsdPrice = currentUsdPrice;
      }
      continue;
    }

    byPriceMint.set(priceMint, {
      mint: holding.mint,
      priceMint,
      symbol: holding.symbol.trim().toUpperCase() || priceSymbol,
      priceSymbol,
      balance: holding.balance,
      stableUsdPrice,
      currentUsdPrice: isPositiveNumber(currentUsdPrice) ? currentUsdPrice : null,
    });
  }

  const allInputs = Array.from(byPriceMint.values()).sort(compareByEstimatedUsdValue);
  const stableInputs = allInputs.filter((input) => input.stableUsdPrice != null);
  const historyInputs = allInputs
    .filter((input) => input.stableUsdPrice == null)
    .slice(0, maxHistoryPricedHoldings);

  return {
    inputs: [...stableInputs, ...historyInputs],
    historyInputs,
  };
}

function findClosestHistorySample(
  samples: readonly MarketHistoricalUsdPricePoint[],
  timestamp: number,
) {
  if (samples.length === 0) return null;

  let closest = samples[0] ?? null;
  let closestDistance = closest ? Math.abs(closest.timestamp - timestamp) : Number.POSITIVE_INFINITY;

  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index];
    if (!sample) continue;

    const distance = Math.abs(sample.timestamp - timestamp);
    if (distance >= closestDistance) continue;
    closest = sample;
    closestDistance = distance;
  }

  return closest;
}

function downsamplePortfolioSamples(
  samples: PortfolioChangeSample[],
): PortfolioChangeSample[] {
  if (samples.length <= maxPortfolioHistorySamples) return samples;

  const result: PortfolioChangeSample[] = [];
  let previousIndex = -1;

  for (let index = 0; index < maxPortfolioHistorySamples; index += 1) {
    const sourceIndex = Math.round(
      (index / Math.max(maxPortfolioHistorySamples - 1, 1)) * (samples.length - 1),
    );
    if (sourceIndex === previousIndex) continue;
    previousIndex = sourceIndex;
    const sample = samples[sourceIndex];
    if (sample) result.push(sample);
  }

  return result;
}

export function buildPortfolioHistorySamples(params: {
  inputs: readonly PortfolioHistoryInput[];
  historiesByMint: ReadonlyMap<string, readonly MarketHistoricalUsdPricePoint[]>;
  timestamp: number;
  durationMs: number;
  liveUsdPricesByMint: ReadonlyMap<string, number>;
}): PortfolioChangeSample[] {
  const eligibleInputs = params.inputs.filter((input) => {
    if (input.stableUsdPrice != null) return true;
    return (params.historiesByMint.get(input.priceMint)?.length ?? 0) >= 2;
  });
  const histories = eligibleInputs
    .filter((input) => input.stableUsdPrice == null)
    .map((input) => params.historiesByMint.get(input.priceMint))
    .filter((history): history is readonly MarketHistoricalUsdPricePoint[] =>
      Boolean(history && history.length >= 2),
    );
  const anchorHistory = histories.reduce<readonly MarketHistoricalUsdPricePoint[] | null>(
    (longest, history) => {
      if (longest == null || history.length > longest.length) return history;
      return longest;
    },
    null,
  );
  const stableUsdValue = eligibleInputs.reduce(
    (total, input) => total + input.balance * (input.stableUsdPrice ?? 0),
    0,
  );

  if (anchorHistory == null) {
    if (stableUsdValue <= 0) return [];
    const startTimestamp = params.timestamp - params.durationMs;

    return [
      { timestamp: startTimestamp, usdValue: stableUsdValue },
      { timestamp: params.timestamp, usdValue: stableUsdValue },
    ];
  }

  const samples: PortfolioChangeSample[] = [];

  for (const anchor of anchorHistory) {
    let usdValue = stableUsdValue;
    let priced = stableUsdValue > 0;

    for (const input of eligibleInputs) {
      if (input.stableUsdPrice != null) continue;

      const sample = findClosestHistorySample(
        params.historiesByMint.get(input.priceMint) ?? [],
        anchor.timestamp,
      );
      if (sample == null) continue;

      priced = true;
      usdValue += input.balance * sample.value;
    }

    if (priced && usdValue > 0) {
      samples.push({ timestamp: anchor.timestamp, usdValue });
    }
  }

  const currentUsdValue = eligibleInputs.reduce((total, input) => {
    const usdPrice =
      input.stableUsdPrice ??
      params.liveUsdPricesByMint.get(input.priceMint) ??
      input.currentUsdPrice;

    return isPositiveNumber(usdPrice) ? total + input.balance * usdPrice : total;
  }, 0);
  const lastSample = samples.at(-1);

  if (
    currentUsdValue > 0 &&
    (lastSample == null || params.timestamp > lastSample.timestamp)
  ) {
    samples.push({ timestamp: params.timestamp, usdValue: currentUsdValue });
  }

  return downsamplePortfolioSamples(samples);
}

export function calculatePortfolioValueChange(
  samples: readonly PortfolioChangeSample[],
): PortfolioValueChange | null {
  const first = samples[0];
  const last = samples.at(-1);

  if (!first || !last || samples.length < 2 || first.usdValue <= 0) {
    return null;
  }

  const absoluteUsd = normalizeSignedZero(last.usdValue - first.usdValue);
  const percent = normalizeSignedZero((absoluteUsd / first.usdValue) * 100);

  return {
    absoluteUsd,
    percent,
    tone: percent > 0 ? "positive" : percent < 0 ? "negative" : "neutral",
  };
}

export function buildMarketHistoryIdentifier(params: {
  cluster: SolanaCluster;
  input: PortfolioHistoryInput;
}): MarketPriceIdentifier {
  if (
    params.cluster === "solana:mainnet" &&
    params.input.priceMint !== nativeSolMint &&
    isLikelySolanaAddress(params.input.priceMint)
  ) {
    return {
      type: "address",
      network: alchemySolanaMainnetNetwork,
      address: params.input.priceMint,
    };
  }

  return {
    type: "symbol",
    symbol: normalizePriceSymbol(params.input.priceSymbol || params.input.symbol),
  };
}
