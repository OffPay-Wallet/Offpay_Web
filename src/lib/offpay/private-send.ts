import { address } from "@solana/kit";

import type { SolanaCluster } from "./types";

export type PrivateSendProvider = "magicblock" | "umbra";

export type PrivateSendToken = {
  decimals: number;
  mint: string;
  name: string;
  symbol: string;
};

const privateSendTokens: Record<SolanaCluster, PrivateSendToken[]> = {
  "solana:mainnet": [
    {
      decimals: 6,
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      name: "USD Coin",
      symbol: "USDC",
    },
    {
      decimals: 6,
      mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      name: "Tether USD",
      symbol: "USDT",
    },
  ],
  "solana:devnet": [
    {
      decimals: 6,
      mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      name: "USD Coin (Devnet)",
      symbol: "USDC",
    },
    {
      decimals: 6,
      mint: "4oG4sjmopf5MzvTHLE8rpVJ2uyczxfsw2K84SUTpNDx7",
      name: "Devnet USDC",
      symbol: "dUSDC",
    },
    {
      decimals: 6,
      mint: "DXQwBNGgyQ2BzGWxEriJPVmXYFQBsQbXvfvfSNTaJkL6",
      name: "Devnet USDT",
      symbol: "dUSDT",
    },
  ],
  "solana:testnet": [],
};

export function privateSendTokensForCluster(cluster: SolanaCluster): PrivateSendToken[] {
  return privateSendTokens[cluster] ?? [];
}

export function validateSolanaAddress(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) return "Enter a recipient address.";

  try {
    address(trimmed);
    return null;
  } catch {
    return "Enter a valid Solana address.";
  }
}

export function parseTokenAmountToAtomic(
  amount: string,
  decimals: number,
): { amountAtomic: bigint; normalized: string } | { error: string } {
  const normalized = amount.trim();

  if (!normalized) return { error: "Enter an amount." };
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { error: "Use digits and one decimal point only." };
  }

  const [wholePart = "", fractionalPart = ""] = normalized.split(".");
  if (fractionalPart.length > decimals) {
    return { error: `Use no more than ${decimals} decimal places.` };
  }

  const whole = BigInt(wholePart || "0");
  const fractional = BigInt(fractionalPart.padEnd(decimals, "0") || "0");
  const scale = 10n ** BigInt(decimals);
  const amountAtomic = whole * scale + fractional;

  if (amountAtomic <= 0n) return { error: "Enter an amount greater than zero." };

  return { amountAtomic, normalized };
}

export function formatAtomicTokenAmount(amountAtomic: bigint, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const whole = amountAtomic / scale;
  const fractional = amountAtomic % scale;

  if (fractional === 0n) return whole.toString();

  return `${whole}.${fractional.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}
