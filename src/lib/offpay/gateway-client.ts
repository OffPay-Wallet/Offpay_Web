import type {
  MarketHistoricalUsdPricePoint,
  MarketTokenPriceHistoryRequest,
  MarketTokenPricesBatchRequest,
  MarketTokenPricesBatchResponse,
  ReadWalletTransactionsInput,
  SolanaCluster,
  SwapTokenListResponse,
  TokenMetadataResponse,
  UmbraGatewayStatus,
  UmbraVaultHoldings,
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

export async function readGatewayUmbraStatus(
  gatewayOrigin: string,
  sessionToken?: string,
): Promise<WebApiEnvelope<UmbraGatewayStatus>> {
  const headers = new Headers();

  if (sessionToken) {
    headers.set("authorization", `Bearer ${sessionToken}`);
  }

  return requestGateway<UmbraGatewayStatus>({
    gatewayOrigin,
    label: "umbra.status",
    path: "/web/umbra/status",
    init: {
      method: "GET",
      credentials: "include",
      headers,
    },
  });
}

export async function readGatewayUmbraVaultHoldings(
  gatewayOrigin: string,
  sessionToken?: string,
): Promise<WebApiEnvelope<UmbraVaultHoldings>> {
  const headers = new Headers();

  if (sessionToken) {
    headers.set("authorization", `Bearer ${sessionToken}`);
  }

  return requestGateway<UmbraVaultHoldings>({
    gatewayOrigin,
    label: "umbra.holdings",
    path: "/web/umbra/holdings",
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
