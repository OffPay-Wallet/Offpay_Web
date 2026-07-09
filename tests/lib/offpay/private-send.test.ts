import { describe, expect, it } from "vitest";

import {
  formatAtomicTokenAmount,
  parseTokenAmountToAtomic,
  privateSendTokensForCluster,
  validateSolanaAddress,
} from "@/lib/offpay/private-send";
import {
  quoteMagicBlockPrivateSendFees,
  quoteUmbraPrivateSendFees,
} from "@/lib/offpay/private-send-fees";
import { getHardcodedCreateUtxoProtocolFeeProvider } from "@umbra-privacy/sdk/fee-provider";
import { BPS_DIVISOR } from "@umbra-privacy/sdk/shared";

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

describe("private send fee helpers", () => {
  it("uses MagicBlock returned fee fields for min received and network fee", () => {
    const quote = quoteMagicBlockPrivateSendFees({
      amountAtomic: 1_000_000n,
      prepared: {
        fees: {
          lamports: "5000",
          tokens: "2500",
        },
        instructionCount: 4,
        kind: "transfer",
        lastValidBlockHeight: 1,
        recentBlockhash: "blockhash",
        requiredSigners: ["11111111111111111111111111111111"],
        sendTo: "base",
        transactionBase64: "AQID",
        version: "v0",
      },
    });

    expect(quote).toMatchObject({
      minReceivedAtomic: 997_500n,
      networkFeeLamports: 5_000n,
      provider: "magicblock",
      tokenFeeAtomic: 2_500n,
    });
  });

  it("uses the Umbra SDK fee provider and BPS divisor for route fees", async () => {
    const feeConfig = await getHardcodedCreateUtxoProtocolFeeProvider()();
    const amountAtomic = 1_000_000n;
    const expectedFee = (amountAtomic * feeConfig.feeBasisPoints) / BPS_DIVISOR;
    const quote = await quoteUmbraPrivateSendFees({
      amountAtomic,
      networkFeeLamports: 2_039_280n,
    });

    expect(quote).toEqual({
      minReceivedAtomic: amountAtomic - expectedFee,
      networkFeeLamports: 2_039_280n,
      provider: "umbra",
      tokenFeeAtomic: expectedFee,
    });
  });
});
