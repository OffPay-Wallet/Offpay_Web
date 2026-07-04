import { describe, expect, it } from "vitest";

import { calculateHoldingValueChanges } from "../../../src/lib/offpay/portfolio-pnl";
import {
  nativeSolMint,
  type PortfolioHolding,
} from "../../../src/lib/offpay/portfolio-valuation";

const holdings: PortfolioHolding[] = [
  {
    id: `native:${nativeSolMint}`,
    mint: nativeSolMint,
    priceMint: nativeSolMint,
    name: "Solana",
    symbol: "SOL",
    priceSymbol: "SOL",
    balance: 2,
    decimals: 9,
    native: true,
  },
  {
    id: "spl:usdc",
    mint: "usdc",
    priceMint: "usdc",
    name: "USD Coin",
    symbol: "USDC",
    priceSymbol: "USDC",
    balance: 100,
    decimals: 6,
  },
];

describe("portfolio holding PnL", () => {
  it("calculates per-token PnL from historical baseline and live prices", () => {
    const changes = calculateHoldingValueChanges({
      holdings,
      unitUsdPrices: { [nativeSolMint]: 160 },
      historiesByMint: new Map([
        [
          nativeSolMint,
          [
            {
              value: 100,
              timestamp: 1_000,
              timestampIso: "2026-07-03T00:00:01.000Z",
              marketCap: null,
              totalVolume: null,
            },
          ],
        ],
      ]),
    });

    expect(changes[nativeSolMint]).toMatchObject({
      absoluteUsd: 120,
      percent: 60,
      tone: "positive",
    });
    expect(changes.usdc).toMatchObject({
      absoluteUsd: 0,
      percent: 0,
      tone: "neutral",
    });
  });

  it("does not fabricate non-stable token PnL without history", () => {
    const changes = calculateHoldingValueChanges({
      holdings: [holdings[0]],
      unitUsdPrices: { [nativeSolMint]: 160 },
      historiesByMint: new Map(),
    });

    expect(changes[nativeSolMint]).toBeUndefined();
  });
});
