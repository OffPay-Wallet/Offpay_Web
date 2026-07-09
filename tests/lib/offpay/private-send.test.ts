import { describe, expect, it } from "vitest";

import {
  formatAtomicTokenAmount,
  parseTokenAmountToAtomic,
  privateSendTokensForCluster,
  validateSolanaAddress,
} from "@/lib/offpay/private-send";

describe("private send token helpers", () => {
  it("keeps private send assets scoped to stable SPL tokens per network", () => {
    expect(privateSendTokensForCluster("solana:devnet").map((token) => token.symbol)).toEqual([
      "USDC",
      "dUSDC",
      "dUSDT",
    ]);
    expect(privateSendTokensForCluster("solana:mainnet").map((token) => token.symbol)).toEqual([
      "USDC",
      "USDT",
    ]);
    expect(privateSendTokensForCluster("solana:testnet")).toEqual([]);
  });

  it("parses and formats token units without floating point math", () => {
    const parsed = parseTokenAmountToAtomic("1.2304", 6);

    expect(parsed).toEqual({
      amountAtomic: 1_230_400n,
      normalized: "1.2304",
    });
    expect(formatAtomicTokenAmount(1_230_400n, 6)).toBe("1.2304");
  });

  it("rejects empty, zero, and over-precise token amounts", () => {
    expect(parseTokenAmountToAtomic("", 6)).toEqual({ error: "Enter an amount." });
    expect(parseTokenAmountToAtomic("0", 6)).toEqual({
      error: "Enter an amount greater than zero.",
    });
    expect(parseTokenAmountToAtomic("1.0000001", 6)).toEqual({
      error: "Use no more than 6 decimal places.",
    });
  });

  it("validates Solana recipient addresses before route execution", () => {
    expect(validateSolanaAddress("11111111111111111111111111111111")).toBeNull();
    expect(validateSolanaAddress("not-a-solana-address")).toBe("Enter a valid Solana address.");
  });
});
