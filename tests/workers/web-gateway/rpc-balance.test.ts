import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWalletPortfolioFromRpc } from "../../../workers/web-gateway/src/rpc-balance";

describe("gateway RPC wallet balance adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Solana RPC balances and token accounts onto the Web Gateway portfolio shape", async () => {
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(String(init?.body)) as { method?: string; params?: unknown[] };

        if (body.method === "getBalance") {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: "test",
              result: {
                value: 2_500_000_000,
              },
            }),
          );
        }

        if (
          body.method === "getTokenAccountsByOwner" &&
          JSON.stringify(body.params).includes("Tokenkeg")
        ) {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: "test",
              result: {
                value: [
                  {
                    account: {
                      owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                      data: {
                        parsed: {
                          info: {
                            mint: "token-mint-1",
                            tokenAmount: {
                              amount: "12340000",
                              decimals: 6,
                              uiAmount: 12.34,
                              uiAmountString: "12.34",
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            }),
          );
        }

        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: "test",
            result: {
              value: [],
            },
          }),
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const portfolio = await fetchWalletPortfolioFromRpc({
      address: "11111111111111111111111111111111",
      cluster: "solana:devnet",
      env: {
        HELIUS_DEVNET_RPC_URL: "https://rpc.example.invalid",
      },
    });

    expect(portfolio).toMatchObject({
      address: "11111111111111111111111111111111",
      cluster: "solana:devnet",
      sol: {
        lamports: "2500000000",
        uiAmount: 2.5,
      },
      tokens: [
        {
          mint: "token-mint-1",
          amount: "12340000",
          decimals: 6,
          uiAmount: 12.34,
          uiAmountString: "12.34",
          programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        },
      ],
    });
  });
});
