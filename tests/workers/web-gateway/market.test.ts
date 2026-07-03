import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchMarketTokenUsdPriceHistory,
  fetchMarketTokenUsdPrice,
} from "../../../workers/web-gateway/src/market";

const alchemyEnv = {
  ALCHEMY_PRICE_API_ORIGIN: "https://api.g.alchemy.example/prices/v1",
  ALCHEMY_PRICE_API_KEY: "alchemy-test-key",
};

describe("gateway market price adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back from path-key auth to bearer auth for historical prices", async () => {
    const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const target = String(input);

      if (target.includes("/alchemy-test-key/")) {
        return new Response(JSON.stringify({ error: { message: "not found" } }), {
          status: 404,
        });
      }

      return new Response(
        JSON.stringify({
          symbol: "SOL",
          currency: "usd",
          data: [
            {
              value: "100.00",
              timestamp: "2026-07-03T00:00:00Z",
              marketCap: "1000",
              totalVolume: "10",
            },
            {
              value: "110.00",
              timestamp: "2026-07-03T00:05:00Z",
              marketCap: "1100",
              totalVolume: "12",
            },
          ],
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const prices = await fetchMarketTokenUsdPriceHistory(
      alchemyEnv,
      { type: "symbol", symbol: "SOL" },
      {
        startTime: "2026-07-03T00:00:00Z",
        endTime: "2026-07-03T00:05:00Z",
        interval: "5m",
      },
    );

    expect(prices).toEqual([
      expect.objectContaining({ value: 100, timestamp: Date.parse("2026-07-03T00:00:00Z") }),
      expect.objectContaining({ value: 110, timestamp: Date.parse("2026-07-03T00:05:00Z") }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toBeInstanceOf(Headers);
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get("authorization")).toBe(
      "Bearer alchemy-test-key",
    );
  });

  it("returns null when the token price is not found by either auth mode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "not found" } }), {
        status: 404,
      })),
    );

    const price = await fetchMarketTokenUsdPrice(
      alchemyEnv,
      { type: "symbol", symbol: "UNKNOWN" },
    );

    expect(price).toBeNull();
  });
});
