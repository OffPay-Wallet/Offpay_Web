import type { GatewayEnv } from "./types";

type GatewayConfigKey = keyof GatewayEnv;
type HttpMethod = "GET" | "POST";

type ConfigGroup = {
  id: string;
  description: string;
  anyOf?: GatewayConfigKey[];
  allOf?: GatewayConfigKey[];
};

export type ManualWorkflowRoute = {
  method: HttpMethod;
  path: string;
  capability: string;
  implemented: boolean;
  public: boolean;
  configGroups: string[];
};

const configGroups = [
  {
    id: "session",
    description: "Gateway browser sessions",
    allOf: ["OFFPAY_WEB_SESSION_SECRET"],
  },
  {
    id: "devnet-rpc-http",
    description: "Devnet HTTP RPC provider",
    anyOf: [
      "HELIUS_DEVNET_RPC_URL",
      "ALCHEMY_DEVNET_RPC_URL",
      "ALCHEMY_DEVNET_FALLBACK_RPC_URL",
    ],
  },
  {
    id: "mainnet-rpc-http",
    description: "Mainnet HTTP RPC provider",
    anyOf: [
      "HELIUS_MAINNET_RPC_URL",
      "ALCHEMY_MAINNET_RPC_URL",
      "ALCHEMY_MAINNET_FALLBACK_RPC_URL",
    ],
  },
  {
    id: "devnet-rpc-websocket",
    description: "Devnet WebSocket RPC provider",
    anyOf: ["HELIUS_DEVNET_WS_URL", "ALCHEMY_DEVNET_WS_URL"],
  },
  {
    id: "mainnet-rpc-websocket",
    description: "Mainnet WebSocket RPC provider",
    anyOf: ["HELIUS_MAINNET_WS_URL", "ALCHEMY_MAINNET_WS_URL"],
  },
  {
    id: "helius-api",
    description: "Helius enhanced API keys",
    anyOf: ["HELIUS_DEVNET_API_KEY", "HELIUS_MAINNET_API_KEY"],
  },
  {
    id: "alchemy-price",
    description: "Alchemy token pricing",
    allOf: ["ALCHEMY_PRICE_API_KEY"],
  },
  {
    id: "jupiter",
    description: "Jupiter swap and trigger API",
    allOf: ["JUPITER_API_BASE_URL", "JUPITER_TRIGGER_API_BASE_URL", "JUPITER_API_KEY"],
  },
  {
    id: "umbra-devnet",
    description: "Umbra devnet indexer and relayer",
    allOf: ["UMBRA_INDEXER_URL_DEVNET", "UMBRA_RELAYER_URL_DEVNET"],
  },
  {
    id: "umbra-mainnet",
    description: "Umbra mainnet indexer and relayer",
    allOf: ["UMBRA_INDEXER_URL_MAINNET", "UMBRA_RELAYER_URL_MAINNET"],
  },
  {
    id: "umbra-runtime",
    description: "Umbra SDK/runtime settings",
    allOf: ["UMBRA_CIRCUIT_VERSION", "UMBRA_MIN_SDK_VERSION", "UMBRA_LOCAL_TEST_MODE"],
  },
  {
    id: "magicblock",
    description: "MagicBlock validator allowlists",
    allOf: ["MAGICBLOCK_DEVNET_VALIDATORS", "MAGICBLOCK_MAINNET_VALIDATORS"],
  },
  {
    id: "offpay-token-mints",
    description: "Offpay supported token mint addresses",
    allOf: [
      "OFFPAY_DEVNET_USDC_MINT",
      "OFFPAY_MAINNET_USDC_MINT",
      "OFFPAY_MAINNET_USDT_MINT",
    ],
  },
] satisfies ConfigGroup[];

export const manualWorkflowRoutes = [
  {
    method: "GET",
    path: "/web/public/balances",
    capability: "wallet-balance",
    implemented: true,
    public: true,
    configGroups: ["devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "GET",
    path: "/web/balances",
    capability: "wallet-balance",
    implemented: true,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "GET",
    path: "/web/wallet/balance",
    capability: "wallet-balance",
    implemented: true,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "GET",
    path: "/web/wallet/dashboard",
    capability: "wallet-dashboard",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http", "alchemy-price"],
  },
  {
    method: "GET",
    path: "/web/wallet/transactions",
    capability: "wallet-history",
    implemented: false,
    public: false,
    configGroups: ["session", "helius-api", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "GET",
    path: "/web/wallet/token-transactions",
    capability: "token-history",
    implemented: false,
    public: false,
    configGroups: ["session", "helius-api", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "GET",
    path: "/web/risk/score",
    capability: "risk-score",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "GET",
    path: "/web/swap/tokens",
    capability: "swap-token-list",
    implemented: false,
    public: false,
    configGroups: ["session", "jupiter", "offpay-token-mints"],
  },
  {
    method: "GET",
    path: "/web/swap/price",
    capability: "swap-price",
    implemented: false,
    public: false,
    configGroups: ["session", "jupiter", "alchemy-price"],
  },
  {
    method: "POST",
    path: "/web/swap/quote",
    capability: "swap-quote",
    implemented: false,
    public: false,
    configGroups: ["session", "jupiter"],
  },
  {
    method: "POST",
    path: "/web/swap/execute",
    capability: "swap-execute",
    implemented: false,
    public: false,
    configGroups: ["session", "jupiter", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "POST",
    path: "/web/swap/trigger",
    capability: "swap-trigger",
    implemented: false,
    public: false,
    configGroups: ["session", "jupiter"],
  },
  {
    method: "POST",
    path: "/web/swap/privacy-envelope/prepare",
    capability: "private-swap-prepare",
    implemented: false,
    public: false,
    configGroups: ["session", "jupiter", "umbra-devnet", "umbra-mainnet", "umbra-runtime"],
  },
  {
    method: "POST",
    path: "/web/swap/privacy-envelope/refresh-quote",
    capability: "private-swap-refresh",
    implemented: false,
    public: false,
    configGroups: ["session", "jupiter"],
  },
  {
    method: "POST",
    path: "/web/swap/privacy-envelope/finalize",
    capability: "private-swap-finalize",
    implemented: false,
    public: false,
    configGroups: ["session", "jupiter", "umbra-devnet", "umbra-mainnet"],
  },
  {
    method: "POST",
    path: "/web/swap/recurring",
    capability: "recurring-swap",
    implemented: false,
    public: false,
    configGroups: ["session", "jupiter"],
  },
  {
    method: "POST",
    path: "/web/payment/private-init-mint",
    capability: "private-payment-init",
    implemented: false,
    public: false,
    configGroups: ["session", "umbra-devnet", "umbra-mainnet", "offpay-token-mints"],
  },
  {
    method: "GET",
    path: "/web/payment/private-balance",
    capability: "private-payment-balance",
    implemented: false,
    public: false,
    configGroups: ["session", "umbra-devnet", "umbra-mainnet"],
  },
  {
    method: "POST",
    path: "/web/payment/private-send",
    capability: "private-payment-send",
    implemented: false,
    public: false,
    configGroups: ["session", "umbra-devnet", "umbra-mainnet", "offpay-token-mints"],
  },
  {
    method: "POST",
    path: "/web/payment/settle",
    capability: "payment-settle",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "GET",
    path: "/web/privacy/shielded-balance",
    capability: "shielded-balance",
    implemented: false,
    public: false,
    configGroups: ["session", "umbra-devnet", "umbra-mainnet"],
  },
  {
    method: "GET",
    path: "/web/privacy/scan-announcements",
    capability: "shielded-scan",
    implemented: false,
    public: false,
    configGroups: ["session", "umbra-devnet", "umbra-mainnet"],
  },
  {
    method: "POST",
    path: "/web/privacy/register-viewing-key",
    capability: "viewing-key-registration",
    implemented: false,
    public: false,
    configGroups: ["session", "umbra-devnet", "umbra-mainnet"],
  },
  {
    method: "GET",
    path: "/web/rpc/latest-blockhash",
    capability: "rpc-latest-blockhash",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "POST",
    path: "/web/rpc/fee-for-message",
    capability: "rpc-fee",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "POST",
    path: "/web/rpc/minimum-balance-for-rent-exemption",
    capability: "rpc-rent",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "POST",
    path: "/web/rpc/accounts",
    capability: "rpc-accounts",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "POST",
    path: "/web/rpc/token-largest-accounts",
    capability: "rpc-token-largest-accounts",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "GET",
    path: "/web/rpc/epoch-info",
    capability: "rpc-epoch-info",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "GET",
    path: "/web/rpc/slot",
    capability: "rpc-slot",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "POST",
    path: "/web/rpc/signature-statuses",
    capability: "rpc-signature-statuses",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "POST",
    path: "/web/rpc/signatures-for-address",
    capability: "rpc-signatures-for-address",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "POST",
    path: "/web/rpc/broadcast",
    capability: "rpc-broadcast",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "POST",
    path: "/web/rpc/offline-slot-broadcast",
    capability: "offline-slot-broadcast",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "mainnet-rpc-http"],
  },
  {
    method: "POST",
    path: "/web/rpc/devnet-airdrop",
    capability: "devnet-airdrop",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-http", "offpay-token-mints"],
  },
  {
    method: "GET",
    path: "/web/stream/capabilities",
    capability: "stream-capabilities",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-websocket", "mainnet-rpc-websocket"],
  },
  {
    method: "GET",
    path: "/web/stream/wallet-activity",
    capability: "wallet-activity-stream",
    implemented: false,
    public: false,
    configGroups: ["session", "devnet-rpc-websocket", "mainnet-rpc-websocket"],
  },
  {
    method: "GET",
    path: "/web/market/fx-rate",
    capability: "market-fx-rate",
    implemented: false,
    public: false,
    configGroups: ["session"],
  },
  {
    method: "POST",
    path: "/web/market/token-price",
    capability: "market-token-price",
    implemented: false,
    public: false,
    configGroups: ["session", "alchemy-price"],
  },
  {
    method: "POST",
    path: "/web/market/token-prices-batch",
    capability: "market-token-prices-batch",
    implemented: false,
    public: false,
    configGroups: ["session", "alchemy-price"],
  },
  {
    method: "POST",
    path: "/web/market/token-price-history",
    capability: "market-token-price-history",
    implemented: false,
    public: false,
    configGroups: ["session", "alchemy-price"],
  },
  {
    method: "GET",
    path: "/web/umbra/utxos",
    capability: "umbra-utxos",
    implemented: false,
    public: false,
    configGroups: ["session", "umbra-devnet", "umbra-mainnet", "umbra-runtime"],
  },
  {
    method: "GET",
    path: "/web/umbra/indexer-health",
    capability: "umbra-indexer-health",
    implemented: false,
    public: false,
    configGroups: ["session", "umbra-devnet", "umbra-mainnet"],
  },
  {
    method: "GET",
    path: "/web/umbra/trees",
    capability: "umbra-trees",
    implemented: false,
    public: false,
    configGroups: ["session", "umbra-devnet", "umbra-mainnet"],
  },
  {
    method: "GET",
    path: "/web/umbra/trees/:treeIndex/proof/:insertionIndex",
    capability: "umbra-proof",
    implemented: false,
    public: false,
    configGroups: ["session", "umbra-devnet", "umbra-mainnet"],
  },
  {
    method: "POST",
    path: "/web/umbra/trees/:treeIndex/proofs",
    capability: "umbra-proofs",
    implemented: false,
    public: false,
    configGroups: ["session", "umbra-devnet", "umbra-mainnet"],
  },
  {
    method: "GET",
    path: "/web/umbra/relayer-info",
    capability: "umbra-relayer-info",
    implemented: false,
    public: false,
    configGroups: ["session", "umbra-devnet", "umbra-mainnet"],
  },
  {
    method: "POST",
    path: "/web/umbra/claim",
    capability: "umbra-claim",
    implemented: false,
    public: false,
    configGroups: ["session", "umbra-devnet", "umbra-mainnet", "umbra-runtime"],
  },
  {
    method: "GET",
    path: "/web/umbra/claim-status/:id",
    capability: "umbra-claim-status",
    implemented: false,
    public: false,
    configGroups: ["session", "umbra-devnet", "umbra-mainnet"],
  },
] satisfies ManualWorkflowRoute[];

function hasValue(env: GatewayEnv, key: GatewayConfigKey): boolean {
  return Boolean(env[key]?.trim());
}

function statusForGroup(env: GatewayEnv, group: ConfigGroup) {
  const anyOf = group.anyOf ?? [];
  const allOf = group.allOf ?? [];
  const missingAllOf = allOf.filter((key) => !hasValue(env, key));
  const anyConfigured = anyOf.length === 0 || anyOf.some((key) => hasValue(env, key));
  const configured = missingAllOf.length === 0 && anyConfigured;

  return {
    id: group.id,
    description: group.description,
    configured,
    anyOf,
    allOf,
    missing: configured ? [] : [...missingAllOf, ...(anyConfigured ? [] : anyOf)],
  };
}

export function manualWorkflowConfigStatus(env: GatewayEnv) {
  const groups = configGroups.map((group) => statusForGroup(env, group));
  const groupStatusById = new Map(groups.map((group) => [group.id, group]));

  return {
    upstreamWorkersRemoved: true,
    groups,
    routes: manualWorkflowRoutes.map((route) => ({
      method: route.method,
      path: route.path,
      capability: route.capability,
      implemented: route.implemented,
      public: route.public,
      configGroups: route.configGroups,
      missingConfig: route.configGroups.flatMap(
        (groupId) => groupStatusById.get(groupId)?.missing ?? [],
      ),
    })),
  };
}
