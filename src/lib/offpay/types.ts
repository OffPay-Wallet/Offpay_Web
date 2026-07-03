export type SolanaCluster = "solana:devnet" | "solana:testnet" | "solana:mainnet";
export type WebWalletCustody = "external-solana" | "privy-solana";

export type OffpayFeature =
  | "home"
  | "vault"
  | "send"
  | "swap"
  | "history";

export type WebWalletIdentity = {
  address: string;
  cluster: SolanaCluster;
  custody: WebWalletCustody;
  privyUserId?: string;
};

export type WebSession = {
  id: string;
  identity: WebWalletIdentity;
  issuedAt: string;
  expiresAt: string;
  deviceId?: string;
};

export type WebSessionVerification = {
  session: WebSession;
  sessionToken: string;
};

export type WebSessionNonce = {
  challengeToken: string;
  expiresAt: string;
  message: string;
  nonce: string;
};

export type WalletTokenBalance = {
  mint: string;
  programId?: string;
  amount: string;
  decimals: number;
  uiAmount: number | null;
  uiAmountString: string;
  name?: string;
  symbol?: string;
  logo?: string | null;
  verified?: boolean;
  spam?: boolean;
};

export type WalletSolBalance = {
  lamports: string;
  uiAmount: number;
  logo?: string | null;
};

export type WalletPortfolio = {
  address: string;
  cluster: SolanaCluster;
  fetchedAt: string;
  sol: WalletSolBalance;
  tokens: WalletTokenBalance[];
};

export type WalletTransactionSignature = {
  signature: string;
  slot: number | null;
  blockTime: number | null;
  memo: string | null;
  failed: boolean;
  confirmationStatus: string | null;
};

export type WalletTransactionsResponse = {
  address: string;
  cluster: SolanaCluster;
  fetchedAt: string;
  signatures: WalletTransactionSignature[];
};

export type ReadWalletTransactionsInput = {
  walletAddress: string;
  network: SolanaCluster;
  limit?: number;
  before?: string;
};

export type MarketPriceIdentifier =
  | {
      type: "symbol";
      symbol: string;
    }
  | {
      type: "address";
      network: string;
      address: string;
    };

export type MarketTokenPricesBatchRequest = {
  currency: "USD";
  network: SolanaCluster;
  tokens: Array<{
    mint: string;
    symbol: string;
    priceSymbol: string;
  }>;
};

export type MarketTokenPricesBatchResponse = {
  network: SolanaCluster;
  currency: "USD";
  rate: 1;
  fetchedAt: number;
  unitUsdPrices: Record<string, number>;
  pricedCount: number;
  expectedCount: number;
};

export type MarketHistoricalPriceInterval = "5m" | "1h" | "1d";

export type MarketHistoricalUsdPricePoint = {
  value: number;
  timestamp: number;
  timestampIso: string;
  marketCap: number | null;
  totalVolume: number | null;
};

export type MarketTokenPriceHistoryRequest = {
  identifier: MarketPriceIdentifier;
  network: SolanaCluster;
  startTime: string;
  endTime: string;
  interval: MarketHistoricalPriceInterval;
  withMarketData?: boolean;
};

export type SwapTokenInfo = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string | null;
  verified?: boolean;
  tags?: string[];
};

export type SwapTokenListResponse = {
  tokens: SwapTokenInfo[];
  fetchedAt: number;
};

export type WebGatewayRequestContext = {
  requestId: string;
  session?: WebSession;
  startedAt: string;
};

export type WebApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type WebApiEnvelope<T> =
  | {
      ok: true;
      data: T;
      requestId: string;
    }
  | {
      ok: false;
      error: WebApiError;
      requestId: string;
    };

export type WalletSigner = {
  address: string;
  cluster: SolanaCluster;
  custody: WebWalletCustody;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: Uint8Array) => Promise<Uint8Array>;
  signAllTransactions?: (transactions: Uint8Array[]) => Promise<Uint8Array[]>;
};

export type PreparedActionKind =
  | "send"
  | "private-send"
  | "swap"
  | "umbra-claim"
  | "payroll-batch"
  | "agent-draft";

export type PreparedAction = {
  id: string;
  kind: PreparedActionKind;
  title: string;
  summary: string;
  unsignedTransaction?: string;
  createdAt: string;
  expiresAt?: string;
  riskLevel: "low" | "medium" | "high";
};

export type ReviewAction = {
  preparedAction: PreparedAction;
  requiresWalletSignature: true;
  userAcknowledgements: string[];
};

export type UmbraClaimDestination = {
  destinationAddress: string;
  claimMode: "self-public-balance" | "encrypted-balance";
  disclosureAccepted: boolean;
};
