import type {
  SolanaCluster,
  UmbraNetwork,
  UmbraVaultHolding,
  UmbraVaultHoldings,
  WebWalletIdentity,
} from "../../../src/lib/offpay/types";
import type { GatewayEnv } from "./types";
import { readUmbraGatewayStatus } from "./umbra-status";

type RelayerInfoResponse = {
  active_stealth_pool_indices?: unknown;
  address?: unknown;
  supported_mints?: unknown;
};

type UmbraTokenMetadata = {
  decimals: number;
  name: string;
  symbol: string;
  tokenProgram: "spl" | "token-2022";
};

export class UmbraVaultGatewayError extends Error {
  code: string;
  details: Record<string, unknown> | undefined;
  status: number;

  constructor({
    code,
    details,
    message,
    status,
  }: {
    code: string;
    details?: Record<string, unknown>;
    message: string;
    status: number;
  }) {
    super(message);
    this.name = "UmbraVaultGatewayError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

const nativeSolMint = "So11111111111111111111111111111111111111112";

const tokenMetadata: Record<UmbraNetwork, Record<string, UmbraTokenMetadata>> = {
  devnet: {
    [nativeSolMint]: {
      decimals: 9,
      name: "Wrapped SOL",
      symbol: "wSOL",
      tokenProgram: "spl",
    },
    "4oG4sjmopf5MzvTHLE8rpVJ2uyczxfsw2K84SUTpNDx7": {
      decimals: 6,
      name: "Dummy USDC",
      symbol: "dUSDC",
      tokenProgram: "spl",
    },
    DXQwBNGgyQ2BzGWxEriJPVmXYFQBsQbXvfvfSNTaJkL6: {
      decimals: 6,
      name: "Dummy USDT",
      symbol: "dUSDT",
      tokenProgram: "spl",
    },
  },
  mainnet: {
    [nativeSolMint]: {
      decimals: 9,
      name: "Wrapped SOL",
      symbol: "wSOL",
      tokenProgram: "spl",
    },
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
      decimals: 6,
      name: "USD Coin",
      symbol: "USDC",
      tokenProgram: "spl",
    },
    Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {
      decimals: 6,
      name: "Tether USD",
      symbol: "USDT",
      tokenProgram: "spl",
    },
    PRVT6TB7uss3FrUd2D9xs2zqDBsa3GbMJMwCQsgmeta: {
      decimals: 6,
      name: "Umbra",
      symbol: "UMBRA",
      tokenProgram: "spl",
    },
    CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH: {
      decimals: 6,
      name: "CASH",
      symbol: "CASH",
      tokenProgram: "spl",
    },
    zinc155BS4mSPk8GXQj4R5hkVDQXcW253pTYq5SGyfi: {
      decimals: 9,
      name: "ZINC",
      symbol: "ZINC",
      tokenProgram: "spl",
    },
  },
};

function readRelayerUrl(env: GatewayEnv, network: UmbraNetwork): string | null {
  const value =
    network === "devnet" ? env.UMBRA_RELAYER_URL_DEVNET : env.UMBRA_RELAYER_URL_MAINNET;
  return value?.trim() || null;
}

function shortMint(mint: string): string {
  return mint.length > 10 ? `${mint.slice(0, 4)}...${mint.slice(-4)}` : mint;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function relayerInfoUrl(relayerUrl: string): string {
  return new URL("/v1/relayer/info", relayerUrl).toString();
}

function mapHolding(network: UmbraNetwork, mint: string): UmbraVaultHolding {
  const metadata = tokenMetadata[network][mint];

  return {
    balanceLabel: "Encrypted",
    balanceState: "encrypted",
    decimals: metadata?.decimals ?? null,
    depositEnabled: true,
    encrypted: true,
    mint,
    name: metadata?.name ?? "Supported Umbra token",
    stealthPoolEnabled: true,
    symbol: metadata?.symbol ?? shortMint(mint),
    tokenProgram: metadata?.tokenProgram ?? "spl",
    uiAmountString: null,
  };
}

async function fetchRelayerInfo(
  relayerUrl: string,
  fetchImpl: typeof fetch,
): Promise<RelayerInfoResponse> {
  const response = await fetchImpl(relayerInfoUrl(relayerUrl), {
    headers: { accept: "application/json" },
    method: "GET",
  });

  if (!response.ok) {
    throw new UmbraVaultGatewayError({
      code: "umbra_relayer_unavailable",
      message: "Unable to sync Umbra supported tokens from the relayer.",
      status: 502,
    });
  }

  return (await response.json()) as RelayerInfoResponse;
}

export async function readUmbraVaultHoldings({
  env,
  fetchImpl = fetch,
  identity,
}: {
  env: GatewayEnv;
  fetchImpl?: typeof fetch;
  identity: WebWalletIdentity;
}): Promise<UmbraVaultHoldings> {
  const status = readUmbraGatewayStatus(env, identity.cluster);

  if (!status.supported || !status.network) {
    throw new UmbraVaultGatewayError({
      code: "umbra_cluster_unsupported",
      message: "Umbra vault holdings are available on devnet and mainnet.",
      status: 400,
    });
  }

  if (!status.configured) {
    throw new UmbraVaultGatewayError({
      code: "umbra_config_missing",
      details: { missing: status.missing },
      message: "Umbra vault holdings are not configured on this Worker.",
      status: 503,
    });
  }

  const relayerUrl = readRelayerUrl(env, status.network);

  if (!relayerUrl) {
    throw new UmbraVaultGatewayError({
      code: "umbra_relayer_missing",
      message: "Umbra relayer is not configured on this Worker.",
      status: 503,
    });
  }

  const relayerInfo = await fetchRelayerInfo(relayerUrl, fetchImpl);
  const supportedMints = normalizeStringArray(relayerInfo.supported_mints);
  const holdings = supportedMints.map((mint) => mapHolding(status.network!, mint));

  return {
    activeStealthPoolIndices: normalizeStringArray(
      relayerInfo.active_stealth_pool_indices,
    ),
    address: identity.address,
    cluster: identity.cluster as Exclude<SolanaCluster, "solana:testnet">,
    fetchedAt: new Date().toISOString(),
    holdings,
    network: status.network,
    relayerAddress:
      typeof relayerInfo.address === "string" && relayerInfo.address.length > 0
        ? relayerInfo.address
        : null,
    supportedMintCount: supportedMints.length,
  };
}
