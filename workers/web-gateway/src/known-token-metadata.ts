import type {
  SolanaCluster,
  WalletTokenBalance,
} from "../../../src/lib/offpay/types";
import type { GatewayEnv } from "./types";

export const devnetUsdcMint = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const mainnetUsdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const mainnetUsdtMint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const offpayDevnetDusdcMint = "4oG4sjmopf5MzvTHLE8rpVJ2uyczxfsw2K84SUTpNDx7";
const offpayDevnetDusdtMint = "DXQwBNGgyQ2BzGWxEriJPVmXYFQBsQbXvfvfSNTaJkL6";

type TokenDisplayMetadata = Pick<
  WalletTokenBalance,
  "logo" | "name" | "spam" | "symbol" | "verified"
>;

function readConfiguredMint(value: string | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function addKnownToken(
  known: Map<string, TokenDisplayMetadata>,
  requestedMints: ReadonlySet<string>,
  mint: string | null,
  metadata: TokenDisplayMetadata,
) {
  if (!mint || !requestedMints.has(mint)) return;
  known.set(mint, metadata);
}

function knownTokenMetadataForCluster({
  cluster,
  env,
  mints,
}: {
  cluster: SolanaCluster;
  env: GatewayEnv;
  mints: readonly string[];
}): ReadonlyMap<string, TokenDisplayMetadata> {
  const requestedMints = new Set(mints);
  const known = new Map<string, TokenDisplayMetadata>();

  if (cluster === "solana:devnet") {
    addKnownToken(known, requestedMints, devnetUsdcMint, {
      name: "USD Coin (Devnet)",
      symbol: "USDC",
    });
    addKnownToken(known, requestedMints, offpayDevnetDusdcMint, {
      name: "Devnet USDC",
      symbol: "dUSDC",
    });
    addKnownToken(known, requestedMints, offpayDevnetDusdtMint, {
      name: "Devnet USDT",
      symbol: "dUSDT",
    });

    const configuredUsdcMint = readConfiguredMint(env.OFFPAY_DEVNET_USDC_MINT);
    if (configuredUsdcMint && configuredUsdcMint !== devnetUsdcMint) {
      addKnownToken(known, requestedMints, configuredUsdcMint, {
        name: "Devnet USDC",
        symbol: "dUSDC",
      });
    }

    addKnownToken(known, requestedMints, readConfiguredMint(env.OFFPAY_DEVNET_USDT_MINT), {
      name: "Devnet USDT",
      symbol: "dUSDT",
    });
  }

  if (cluster === "solana:mainnet") {
    addKnownToken(known, requestedMints, mainnetUsdcMint, {
      name: "USD Coin",
      symbol: "USDC",
    });
    addKnownToken(known, requestedMints, mainnetUsdtMint, {
      name: "Tether USD",
      symbol: "USDT",
    });
    addKnownToken(known, requestedMints, readConfiguredMint(env.OFFPAY_MAINNET_USDC_MINT), {
      name: "USD Coin",
      symbol: "USDC",
    });
    addKnownToken(known, requestedMints, readConfiguredMint(env.OFFPAY_MAINNET_USDT_MINT), {
      name: "Tether USD",
      symbol: "USDT",
    });
  }

  return known;
}

export function mergeKnownTokenDisplayMetadata({
  cluster,
  env,
  metadata,
  mints,
}: {
  cluster: SolanaCluster;
  env: GatewayEnv;
  metadata: Map<string, TokenDisplayMetadata>;
  mints: readonly string[];
}): Map<string, TokenDisplayMetadata> {
  for (const [mint, known] of knownTokenMetadataForCluster({ cluster, env, mints })) {
    const existing = metadata.get(mint);
    metadata.set(mint, {
      ...(existing ?? {}),
      ...(known.name ? { name: known.name } : {}),
      ...(known.symbol ? { symbol: known.symbol } : {}),
    });
  }

  return metadata;
}

export function applyKnownTokenBalanceMetadata({
  cluster,
  env,
  tokens,
}: {
  cluster: SolanaCluster;
  env: GatewayEnv;
  tokens: WalletTokenBalance[];
}): WalletTokenBalance[] {
  const known = knownTokenMetadataForCluster({
    cluster,
    env,
    mints: tokens.map((token) => token.mint),
  });

  if (known.size === 0) return tokens;

  return tokens.map((token) => {
    const metadata = known.get(token.mint);
    return metadata ? { ...token, ...metadata } : token;
  });
}
