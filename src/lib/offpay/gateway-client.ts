import type {
  MarketHistoricalUsdPricePoint,
  MarketTokenPriceHistoryRequest,
  MarketTokenPricesBatchRequest,
  MarketTokenPricesBatchResponse,
  ReadWalletTransactionsInput,
  SolanaCluster,
  SwapTokenListResponse,
  WalletPortfolio,
  WalletTransactionsResponse,
  WebApiEnvelope,
  WebWalletCustody,
  WebSession,
  WebSessionNonce,
  WebSessionVerification,
} from "./types";
import {
  debugError,
  debugLog,
  debugWarn,
  markOffpayPerformance,
  measureOffpayPerformance,
  offpayPerformanceNow,
  redactIdentifier,
} from "./debug";

export type CreateNonceInput = {
  walletAddress: string;
  network: SolanaCluster;
  custody: WebWalletCustody;
  deviceId?: string;
};

export type VerifySessionInput = CreateNonceInput & {
  challengeToken: string;
  message: string;
  signature: string;
  signedMessage: string;
};

export type ReadPublicBalancesInput = {
  walletAddress: string;
  network: SolanaCluster;
  deviceId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGatewayEnvelope<T>(payload: unknown): payload is WebApiEnvelope<T> {
  if (!isRecord(payload) || typeof payload.ok !== "boolean") {
    return false;
  }

  if (typeof payload.requestId !== "string") {
    return false;
  }

  if (payload.ok) {
    return "data" in payload;
  }

  return (
    isRecord(payload.error) &&
    typeof payload.error.code === "string" &&
    typeof payload.error.message === "string"
  );
}

function createClientRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

async function readEnvelope<T>(response: Response): Promise<WebApiEnvelope<T>> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      requestId: response.headers.get("x-offpay-request-id") ?? "missing",
      error: {
        code: "invalid_gateway_json",
        message: `Gateway returned ${response.status} without a valid JSON envelope.`,
      },
    };
  }

  if (!isGatewayEnvelope<T>(payload)) {
    return {
      ok: false,
      requestId: response.headers.get("x-offpay-request-id") ?? "missing",
      error: {
        code: "invalid_gateway_envelope",
        message: "Gateway returned an unexpected response envelope.",
      },
    };
  }

  if (!response.ok && payload.ok) {
    return {
      ok: false,
      requestId: payload.requestId,
      error: {
        code: "http_error",
        message: `Gateway returned ${response.status}.`,
      },
    };
  }

  return payload;
}

async function requestGateway<T>({
  context,
  gatewayOrigin,
  init,
  label,
  path,
}: {
  context?: Record<string, unknown>;
  gatewayOrigin: string;
  init: RequestInit;
  label: string;
  path: string;
}): Promise<WebApiEnvelope<T>> {
  const requestId = createClientRequestId();
  const target = new URL(path, gatewayOrigin);
  const headers = new Headers(init.headers);
  const method = init.method ?? "GET";
  const startedAt = offpayPerformanceNow();
  const markName = `api:${label}:${requestId}`;

  headers.set("x-offpay-request-id", requestId);
  markOffpayPerformance(`${markName}:start`);
  debugLog("api.request", {
    label,
    method,
    path: target.pathname,
    requestId,
    ...context,
  });

  try {
    const response = await fetch(target, {
      ...init,
      headers,
    });
    const envelope = await readEnvelope<T>(response);
    const durationMs = offpayPerformanceNow() - startedAt;

    markOffpayPerformance(`${markName}:end`);
    measureOffpayPerformance(markName, `${markName}:start`, `${markName}:end`);

    const event = envelope.ok ? "api.response" : "api.error";
    const fields = {
      label,
      method,
      ok: envelope.ok,
      path: target.pathname,
      requestId: envelope.requestId,
      status: response.status,
      durationMs: Number(durationMs.toFixed(1)),
      serverTiming: response.headers.get("server-timing"),
      ...(!envelope.ok ? { error: envelope.error } : {}),
      ...context,
    };

    if (envelope.ok) {
      debugLog(event, fields);
    } else {
      debugWarn(event, fields);
    }

    return envelope;
  } catch (error) {
    const durationMs = offpayPerformanceNow() - startedAt;

    debugError("api.network_error", {
      label,
      method,
      path: target.pathname,
      requestId,
      durationMs: Number(durationMs.toFixed(1)),
      error: error instanceof Error ? error.message : "Unknown network error",
      ...context,
    });

    throw error;
  }
}

export async function createSessionNonce(
  gatewayOrigin: string,
  input: CreateNonceInput,
): Promise<WebApiEnvelope<WebSessionNonce>> {
  return requestGateway<WebSessionNonce>({
    gatewayOrigin,
    label: "session.nonce",
    path: "/web/session/nonce",
    init: {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    },
    context: {
      custody: input.custody,
      network: input.network,
      walletAddress: redactIdentifier(input.walletAddress),
    },
  });
}

export async function verifyGatewaySession(
  gatewayOrigin: string,
  input: VerifySessionInput,
): Promise<WebApiEnvelope<WebSessionVerification>> {
  return requestGateway<WebSessionVerification>({
    gatewayOrigin,
    label: "session.verify",
    path: "/web/session/verify",
    init: {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    },
    context: {
      custody: input.custody,
      network: input.network,
      walletAddress: redactIdentifier(input.walletAddress),
    },
  });
}

export async function readGatewaySessionStatus(
  gatewayOrigin: string,
  sessionToken?: string,
): Promise<WebApiEnvelope<WebSession | null>> {
  const headers = new Headers();

  if (sessionToken) {
    headers.set("authorization", `Bearer ${sessionToken}`);
  }

  return requestGateway<WebSession | null>({
    gatewayOrigin,
    label: "session.status",
    path: "/web/session/status",
    init: {
      method: "GET",
      credentials: "include",
      headers,
    },
  });
}

export async function readGatewayBalances(
  gatewayOrigin: string,
  sessionToken?: string,
): Promise<WebApiEnvelope<WalletPortfolio>> {
  const headers = new Headers();

  if (sessionToken) {
    headers.set("authorization", `Bearer ${sessionToken}`);
  }

  return requestGateway<WalletPortfolio>({
    gatewayOrigin,
    label: "wallet.balances",
    path: "/web/balances",
    init: {
      method: "GET",
      credentials: "include",
      headers,
    },
  });
}

export async function readGatewayPublicBalances(
  gatewayOrigin: string,
  input: ReadPublicBalancesInput,
): Promise<WebApiEnvelope<WalletPortfolio>> {
  const searchParams = new URLSearchParams({
    address: input.walletAddress,
    network: input.network,
  });

  return requestGateway<WalletPortfolio>({
    gatewayOrigin,
    label: "wallet.public_balances",
    path: `/web/public/balances?${searchParams.toString()}`,
    init: {
      method: "GET",
      credentials: "include",
    },
    context: {
      network: input.network,
      walletAddress: redactIdentifier(input.walletAddress),
    },
  });
}

export async function readGatewayTokenPricesBatch(
  gatewayOrigin: string,
  input: MarketTokenPricesBatchRequest,
): Promise<WebApiEnvelope<MarketTokenPricesBatchResponse>> {
  return requestGateway<MarketTokenPricesBatchResponse>({
    gatewayOrigin,
    label: "market.token_prices_batch",
    path: "/web/market/token-prices-batch",
    init: {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    },
    context: {
      network: input.network,
      tokenCount: input.tokens.length,
    },
  });
}

export async function readGatewaySwapTokens(
  gatewayOrigin: string,
): Promise<WebApiEnvelope<SwapTokenListResponse>> {
  return requestGateway<SwapTokenListResponse>({
    gatewayOrigin,
    label: "swap.tokens",
    path: "/web/swap/tokens",
    init: {
      method: "GET",
      credentials: "include",
    },
  });
}

export async function readGatewayWalletTransactions(
  gatewayOrigin: string,
  input: ReadWalletTransactionsInput,
): Promise<WebApiEnvelope<WalletTransactionsResponse>> {
  const searchParams = new URLSearchParams({
    address: input.walletAddress,
    network: input.network,
  });
  if (input.limit) searchParams.set("limit", String(input.limit));
  if (input.before) searchParams.set("before", input.before);

  return requestGateway<WalletTransactionsResponse>({
    gatewayOrigin,
    label: "public_transactions",
    path: `/web/public/transactions?${searchParams.toString()}`,
    init: { method: "GET", credentials: "include" },
    context: {
      network: input.network,
      walletAddress: redactIdentifier(input.walletAddress),
    },
  });
}

export async function readGatewayTokenPriceHistory(
  gatewayOrigin: string,
  input: MarketTokenPriceHistoryRequest,
): Promise<WebApiEnvelope<{ prices: MarketHistoricalUsdPricePoint[] }>> {
  return requestGateway<{ prices: MarketHistoricalUsdPricePoint[] }>({
    gatewayOrigin,
    label: "market.token_price_history",
    path: "/web/market/token-price-history",
    init: {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    },
    context: {
      identifierType: input.identifier.type,
      interval: input.interval,
      network: input.network,
    },
  });
}
