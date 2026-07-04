import { describe, expect, it } from "vitest";

import { formatTransactionAmount } from "../../../src/components/dashboard/history-format";
import type { WalletTransactionSignature } from "../../../src/lib/offpay/types";

const tokenMint = "4oG4sjmopf5MzvTHLE8rpVJ2uyczxfsw2K84SUTpNDx7";

function transaction(
  asset: NonNullable<WalletTransactionSignature["asset"]>,
): WalletTransactionSignature {
  return {
    asset,
    assets: [asset],
    blockTime: 1_780_000_000,
    confirmationStatus: "finalized",
    failed: false,
    memo: null,
    signature: "3krVAP111111111111111111111111111111111111111111111111111111111",
    slot: 1,
    summary: {
      kind: "received",
      label: "Received",
      tone: "positive",
    },
  };
}

describe("history amount formatting", () => {
  it("uses the token ticker when metadata includes one", () => {
    expect(
      formatTransactionAmount(
        transaction({
          decimals: 6,
          mint: tokenMint,
          rawAmountChange: "5000000",
          symbol: "dUSDC",
          uiAmountChange: 5,
        }),
      ),
    ).toBe("+5 dUSDC");
  });

  it("does not fall back to a shortened mint when token metadata is missing", () => {
    expect(
      formatTransactionAmount(
        transaction({
          decimals: 6,
          mint: tokenMint,
          rawAmountChange: "5000000",
          uiAmountChange: 5,
        }),
      ),
    ).toBe("+5 Token");
  });
});
