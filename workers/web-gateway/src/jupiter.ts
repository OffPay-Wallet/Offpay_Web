import type { SwapTokenInfo } from "../../../src/lib/offpay/types";
import type { GatewayEnv } from "./types";

const jupiterTimeoutMs = 12_000;
// Jupiter's public token catalog. The base origin is configured via binding so
// no origin/key is hardcoded; only the well-known API path shape lives here.
const jupiterVerifiedTokensPath = "/tokens/v1/tagged/verified";
const maxTokens = 5_000;

export class JupiterGatewayError extends Error {
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
    this.name = "JupiterGatewayError";
    this.code = code;
    this.status = status;

    if (details) {
      this.details = details;
    }
  }
}

function configuredHttpsOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString().replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readDecimals(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 32) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return parsed <= 32 ? parsed : null;
  }

  return null;
}

function readHttpsUrl(value: unknown): string | null {
  const raw = readString(value);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function readTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const tags = value
    .map((tag) => readString(tag))
    .filter((tag): tag is string => tag != null);

  return tags.length > 0 ? tags : undefined;
}

function readTokenItems(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => {
      const record = readRecord(item);
      return record ? [record] : [];
    });
  }

  const container = readRecord(payload);
  const candidate = container?.tokens ?? container?.data ?? container?.items;

  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.flatMap((item) => {
    const record = readRecord(item);
    return record ? [record] : [];
  });
}

function normalizeToken(record: Record<string, unknown>): SwapTokenInfo | null {
  const address =
    readString(record.address) ?? readString(record.id) ?? readString(record.mint);
  const decimals = readDecimals(record.decimals);
  const symbol = readString(record.symbol);

  if (!address || decimals == null || !symbol) {
    return null;
  }

  const name = readString(record.name) ?? symbol;
  const logoURI =
    readHttpsUrl(record.logoURI) ??
    readHttpsUrl(record.logo) ??
    readHttpsUrl(record.icon) ??
    readHttpsUrl(record.image);
  const tags = readTags(record.tags);
  const verifiedByTag = tags?.includes("verified") ?? false;

  return {
    address,
    symbol,
    name,
    decimals,
    logoURI,
    ...(verifiedByTag ? { verified: true } : {}),
    ...(tags ? { tags } : {}),
  };
}

export async function fetchJupiterTokenList(env: GatewayEnv): Promise<SwapTokenInfo[]> {
  const origin = configuredHttpsOrigin(env.JUPITER_API_BASE_URL);

  if (!origin) {
    throw new JupiterGatewayError({
      code: "swap_config_missing",
      message: "Jupiter swap API is not configured for the Web Gateway.",
      status: 503,
      details: { expectedKeys: ["JUPITER_API_BASE_URL"] },
    });
  }

  const apiKey = env.JUPITER_API_KEY?.trim();
  const headers: Record<string, string> = { accept: "application/json" };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), jupiterTimeoutMs);

  let response: Response;
  try {
    response = await fetch(`${origin}${jupiterVerifiedTokensPath}`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    throw new JupiterGatewayError({
      code: "swap_upstream_unreachable",
      message: "Failed to reach the Jupiter token API.",
      status: 502,
      details: { cause: error instanceof Error ? error.message : "unknown" },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new JupiterGatewayError({
      code: "swap_upstream_error",
      message: `Jupiter token API returned HTTP ${response.status}.`,
      status: response.status === 429 ? 429 : 502,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new JupiterGatewayError({
      code: "swap_invalid_response",
      message: "Jupiter token API returned an invalid response.",
      status: 502,
    });
  }

  const seen = new Set<string>();
  const tokens: SwapTokenInfo[] = [];

  for (const item of readTokenItems(payload)) {
    const token = normalizeToken(item);
    if (!token || seen.has(token.address)) continue;
    seen.add(token.address);
    tokens.push(token);
    if (tokens.length >= maxTokens) break;
  }

  tokens.sort((left, right) => left.symbol.localeCompare(right.symbol));

  return tokens;
}
