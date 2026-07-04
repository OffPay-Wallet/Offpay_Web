import { describe, expect, it } from "vitest";

import type { UmbraVaultHolding, WalletPortfolio } from "@/lib/offpay/types";
import { validateUmbraVaultPreflight } from "@/components/umbra/umbra-vault-validation";

const holding: UmbraVaultHolding = {
  balanceLabel: "Encrypted",
  balanceState: "encrypted",
  decimals: 6,
  depositEnabled: true,
  encrypted: true,
  mint: "Dusdc11111111111111111111111111111111111111",
  name: "Dummy USDC",
  stealthPoolEnabled: true,
  symbol: "dUSDC",
  tokenProgram: "spl",
  uiAmountString: null,
};
const nativeSolHolding: UmbraVaultHolding = {
  ...holding,
  decimals: 9,
  mint: "So11111111111111111111111111111111111111112",
  name: "Wrapped SOL",
  symbol: "wSOL",
};

function portfolio({
  lamports = "10000",
  tokenAmount = "1000000",
}: {
  lamports?: string;
  tokenAmount?: string;
} = {}): WalletPortfolio {
  return {
    address: "11111111111111111111111111111111",
    cluster: "solana:devnet",
    fetchedAt: "2026-07-04T00:00:00.000Z",
    sol: {
      lamports,
      uiAmount: Number(lamports) / 1_000_000_000,
    },
    tokens: [
      {
        amount: tokenAmount,
        decimals: 6,
        mint: holding.mint,
        name: holding.name,
        symbol: holding.symbol,
        uiAmount: Number(tokenAmount) / 1_000_000,
        uiAmountString: String(Number(tokenAmount) / 1_000_000),
      },
    ],
  };
}

describe("Umbra vault preflight validation", () => {
  it("blocks shield when public token balance is insufficient", () => {
    const result = validateUmbraVaultPreflight({
      action: "shield",
      amount: "2",
      holding,
      portfolio: portfolio({ tokenAmount: "1000000" }),
      portfolioError: null,
      portfolioLoading: false,
      walletReady: true,
    });

    expect(result).toEqual({
      ok: false,
      field: "amount",
      message: "Insufficient dUSDC. Available: 1 dUSDC.",
    });
  });

  it("blocks shield when SOL fee coverage is too low", () => {
    const result = validateUmbraVaultPreflight({
      action: "shield",
      amount: "1",
      holding,
      portfolio: portfolio({ lamports: "4000", tokenAmount: "1000000" }),
      portfolioError: null,
      portfolioLoading: false,
      walletReady: true,
    });

    expect(result).toEqual({
      ok: false,
      message: "Need at least 0.000005 SOL for network fees.",
    });
  });

  it("blocks unshield until encrypted balance is readable", () => {
    const result = validateUmbraVaultPreflight({
      action: "unshield",
      amount: "1",
      holding,
      portfolio: portfolio(),
      portfolioError: null,
      portfolioLoading: false,
      walletReady: true,
    });

    expect(result).toEqual({
      ok: false,
      message: "Encrypted dUSDC balance is not readable yet.",
      retryBalances: true,
    });
  });

  it("passes shield when public token balance and SOL fees are covered", () => {
    const result = validateUmbraVaultPreflight({
      action: "shield",
      amount: "1",
      holding,
      portfolio: portfolio({ lamports: "10000", tokenAmount: "1000000" }),
      portfolioError: null,
      portfolioLoading: false,
      walletReady: true,
    });

    expect(result).toEqual({ ok: true });
  });

  it("uses native SOL as spendable wSOL while reserving network fees", () => {
    const result = validateUmbraVaultPreflight({
      action: "shield",
      amount: "0.000005",
      holding: nativeSolHolding,
      portfolio: portfolio({ lamports: "10000" }),
      portfolioError: null,
      portfolioLoading: false,
      walletReady: true,
    });

    expect(result).toEqual({ ok: true });
  });

  it("blocks wSOL shield amounts that consume SOL fee coverage", () => {
    const result = validateUmbraVaultPreflight({
      action: "shield",
      amount: "0.000006",
      holding: nativeSolHolding,
      portfolio: portfolio({ lamports: "10000" }),
      portfolioError: null,
      portfolioLoading: false,
      walletReady: true,
    });

    expect(result).toEqual({
      ok: false,
      field: "amount",
      message: "Insufficient wSOL. Available: 0.000005 wSOL.",
    });
  });
});
