import type { WebSession } from "../../../src/lib/offpay/types";

export type GatewayEnv = {
  OFFPAY_ALLOWED_WEB_ORIGINS?: string;
  OFFPAY_WEB_SESSION_SECRET?: string;
  OFFPAY_DEBUG_LOGS?: string;
  OFFPAY_ALLOW_LOCALHOST_ORIGINS?: string;
  HELIUS_DEVNET_API_KEY?: string;
  HELIUS_MAINNET_API_KEY?: string;
  HELIUS_DEVNET_RPC_URL?: string;
  HELIUS_MAINNET_RPC_URL?: string;
  HELIUS_DEVNET_WS_URL?: string;
  HELIUS_MAINNET_WS_URL?: string;
  ALCHEMY_DEVNET_RPC_URL?: string;
  ALCHEMY_MAINNET_RPC_URL?: string;
  ALCHEMY_DEVNET_FALLBACK_RPC_URL?: string;
  ALCHEMY_MAINNET_FALLBACK_RPC_URL?: string;
  ALCHEMY_DEVNET_WS_URL?: string;
  ALCHEMY_MAINNET_WS_URL?: string;
  ALCHEMY_PRICE_API_KEY?: string;
  JUPITER_API_BASE_URL?: string;
  JUPITER_TRIGGER_API_BASE_URL?: string;
  JUPITER_API_KEY?: string;
  UMBRA_INDEXER_URL_DEVNET?: string;
  UMBRA_INDEXER_URL_MAINNET?: string;
  UMBRA_RELAYER_URL_DEVNET?: string;
  UMBRA_RELAYER_URL_MAINNET?: string;
  UMBRA_CIRCUIT_VERSION?: string;
  UMBRA_MIN_SDK_VERSION?: string;
  UMBRA_LOCAL_TEST_MODE?: string;
  MAGICBLOCK_DEVNET_VALIDATORS?: string;
  MAGICBLOCK_MAINNET_VALIDATORS?: string;
  OFFPAY_DEVNET_USDC_MINT?: string;
  OFFPAY_DEVNET_USDT_MINT?: string;
  OFFPAY_MAINNET_USDC_MINT?: string;
  OFFPAY_MAINNET_USDT_MINT?: string;
};

export type GatewayVariables = {
  requestId: string;
  startedAtMs: number;
  session: WebSession;
};

export type GatewayBindings = {
  Bindings: GatewayEnv;
  Variables: GatewayVariables;
};
