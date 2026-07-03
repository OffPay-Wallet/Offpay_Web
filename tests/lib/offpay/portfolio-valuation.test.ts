import { describe, expect, it } from "vitest";

import {
  buildPortfolioHistorySamples,
  buildPortfolioValuation,
  calculatePortfolioValueChange,
  nativeSolMint,
  selectPortfolioHistoryInputs,
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

describe("portfolio valuation", () => {
  it("values current holdings from live token prices and stablecoin parity", () => {
    const valuation = buildPortfolioValuation({
      holdings,
      unitUsdPrices: {
        [nativeSolMint]: 150,
      },
    });

    expect(valuation).toMatchObject({
      expectedCount: 2,
      pricedCount: 2,
      totalUsd: 400,
    });
  });

  it("builds current-holdings value-change samples from historical token prices", () => {
    const selection = selectPortfolioHistoryInputs({
      holdings,
      currentUnitUsdPrices: {
        [nativeSolMint]: 160,
      },
    });
    const samples = buildPortfolioHistorySamples({
      inputs: selection.inputs,
      durationMs: 24 * 60 * 60 * 1000,
      timestamp: 2_000,
      liveUsdPricesByMint: new Map([[nativeSolMint, 160]]),
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
            {
              value: 150,
              timestamp: 1_500,
              timestampIso: "2026-07-03T00:00:01.500Z",
              marketCap: null,
              totalVolume: null,
            },
          ],
        ],
      ]),
    });
    const change = calculatePortfolioValueChange(samples);

    expect(samples.map((sample) => sample.usdValue)).toEqual([300, 400, 420]);
    expect(change).toMatchObject({
      absoluteUsd: 120,
      percent: 40,
      tone: "positive",
    });
  });
});
