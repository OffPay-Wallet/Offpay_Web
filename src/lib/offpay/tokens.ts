import type { SolanaCluster } from "./types";

export type TokenMeta = {
  symbol: string;
  name: string;
};

export const nativeSolMeta: TokenMeta = {
  symbol: "SOL",
  name: "Solana",
};

// Public, well-known SPL mint constants. These are token identifiers (not
// origins or secrets), keyed by cluster so labels stay correct per network.
const knownMints: Record<SolanaCluster, Record<string, TokenMeta>> = {
  "solana:mainnet": {
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", name: "USD Coin" },
    Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: "USDT", name: "Tether USD" },
  },
  "solana:devnet": {
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": { symbol: "USDC", name: "USD Coin (Devnet)" },
    "4oG4sjmopf5MzvTHLE8rpVJ2uyczxfsw2K84SUTpNDx7": { symbol: "dUSDC", name: "Devnet USDC" },
    DXQwBNGgyQ2BzGWxEriJPVmXYFQBsQbXvfvfSNTaJkL6: { symbol: "dUSDT", name: "Devnet USDT" },
  },
  "solana:testnet": {},
};

export function shortenMint(mint: string): string {
  if (mint.length <= 10) {
    return mint;
  }

  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

export function resolveTokenMeta(cluster: SolanaCluster, mint: string): TokenMeta {
  const known = knownMints[cluster]?.[mint];

  if (known) {
    return known;
  }

  return {
    symbol: shortenMint(mint),
    name: "SPL Token",
  };
}

export function formatTokenAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "0";
  }

  if (value === 0) {
    return "0";
  }

  const abs = Math.abs(value);
  let maximumFractionDigits: number;

  if (abs >= 1000) {
    maximumFractionDigits = 2;
  } else if (abs >= 1) {
    maximumFractionDigits = 4;
  } else if (abs >= 0.0001) {
    maximumFractionDigits = 6;
  } else {
    maximumFractionDigits = 9;
  }

  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}
