import type {
  MarketHistoricalUsdPricePoint,
  MarketTokenPriceHistoryRequest,
  MarketTokenPricesBatchRequest,
  MarketTokenPricesBatchResponse,
  ReadWalletTransactionsInput,
  SolanaCluster,
  SwapTokenListResponse,
  TokenMetadataResponse,
  UmbraVaultHoldings,
  UmbraVaultRegistrationStatus,
  WalletPortfolio,
  WalletTransactionsResponse,
  WebApiEnvelope,
  WebWalletCustody,
  WebSession,
  WebSessionNonce,
  WebSessionVerification,
} from "./types";
import { redactIdentifier } from "./debug";
import { requestGateway } from "./gateway-core";

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

export type ReadUmbraGatewayInput = {
  walletAddress: string;
  network: SolanaCluster;
};

type JsonRpcEnvelope<T> = {
  error?: {
    code?: number;
    message?: string;
  };
  id?: unknown;
  jsonrpc?: "2.0";
  result?: T;
};

function clusterToRpcProxyNetwork(network: SolanaCluster): "devnet" | "mainnet" {
  if (network === "solana:mainnet") return "mainnet";
  return "devnet";
}

async function requestGatewayRpc<T>({
  body,
  gatewayOrigin,
  label,
  network,
}: {
  body: Record<string, unknown>;
  gatewayOrigin: string;
  label: string;
  network: SolanaCluster;
}): Promise<T> {
  const target = new URL(`/web/rpc/${clusterToRpcProxyNetwork(network)}`, gatewayOrigin);
  const response = await fetch(target, {
    body: JSON.stringify(body),
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const payload = await response.json() as JsonRpcEnvelope<T>;

  if (!response.ok || payload.error || payload.result == null) {
    throw new Error(payload.error?.message ?? `${label} RPC request failed.`);
  }

  return payload.result;
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

export async function readGatewayUmbraVaultHoldings(
  gatewayOrigin: string,
  input: ReadUmbraGatewayInput,
): Promise<WebApiEnvelope<UmbraVaultHoldings>> {
  const searchParams = new URLSearchParams({
    address: input.walletAddress,
    network: input.network,
  });

  return requestGateway<UmbraVaultHoldings>({
    gatewayOrigin,
    label: "umbra.holdings",
    path: `/web/umbra/holdings?${searchParams.toString()}`,
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

export async function readGatewayUmbraVaultRegistrationStatus(
  gatewayOrigin: string,
  input: ReadUmbraGatewayInput,
): Promise<WebApiEnvelope<UmbraVaultRegistrationStatus>> {
  const searchParams = new URLSearchParams({
    address: input.walletAddress,
    network: input.network,
  });

  return requestGateway<UmbraVaultRegistrationStatus>({
    gatewayOrigin,
    label: "umbra.registration",
    path: `/web/umbra/registration?${searchParams.toString()}`,
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

export async function readGatewayMinimumBalanceForRentExemption(
  gatewayOrigin: string,
  input: { network: SolanaCluster; space: number },
): Promise<bigint> {
  const lamports = await requestGatewayRpc<number>({
    gatewayOrigin,
    label: "rpc.minimum_balance_for_rent_exemption",
    network: input.network,
    body: {
      id: "offpay-min-rent",
      jsonrpc: "2.0",
      method: "getMinimumBalanceForRentExemption",
      params: [input.space],
    },
  });

  return BigInt(lamports);
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

export async function readGatewayTokenMetadata(
  gatewayOrigin: string,
  input: { network: SolanaCluster; mints: string[] },
): Promise<WebApiEnvelope<TokenMetadataResponse>> {
  const searchParams = new URLSearchParams({
    network: input.network,
    mints: input.mints.join(","),
  });

  return requestGateway<TokenMetadataResponse>({
    gatewayOrigin,
    label: "public_token_metadata",
    path: `/web/public/token-metadata?${searchParams.toString()}`,
    init: { method: "GET", credentials: "include" },
    context: { network: input.network, mintCount: input.mints.length },
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
