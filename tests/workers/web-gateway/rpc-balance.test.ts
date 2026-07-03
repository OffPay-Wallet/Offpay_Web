import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWalletPortfolioFromRpc } from "../../../workers/web-gateway/src/rpc-balance";

describe("gateway RPC wallet balance adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Solana RPC balances and token accounts onto the Web Gateway portfolio shape", async () => {
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(String(init?.body)) as { method?: string; params?: unknown };

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

  it("uses Helius owner-indexed fungible asset metadata for token logos", async () => {
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(String(init?.body)) as { method?: string; params?: unknown };

        if (body.method === "getBalance") {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: "test",
              result: {
                value: 0,
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
                              amount: "15000000",
                              decimals: 6,
                              uiAmount: 15,
                              uiAmountString: "15",
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

        if (body.method === "getAssetBatch") {
          const ids =
            typeof body.params === "object" && body.params != null
              ? ((body.params as { ids?: unknown }).ids as unknown)
              : null;
          const idList = Array.isArray(ids) ? ids.map(String) : [];

          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: "test",
              result: idList.map((id) =>
                id === "So11111111111111111111111111111111111111112"
                  ? {
                      id,
                      content: {
                        metadata: {
                          name: "Wrapped SOL",
                          symbol: "SOL",
                        },
                        links: {
                          image: "https://assets.example.invalid/sol.png",
                        },
                      },
                    }
                  : null,
              ),
            }),
          );
        }

        if (body.method === "searchAssets") {
          expect(body.params).toMatchObject({
            ownerAddress: "11111111111111111111111111111111",
            tokenType: "fungible",
          });

          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: "test",
              result: {
                total: 1,
                limit: 1000,
                page: 1,
                items: [
                  {
                    id: "token-mint-1",
                    content: {
                      metadata: {
                        name: "USD Coin (Devnet)",
                        symbol: "USDC",
                      },
                      links: {
                        image: "https://assets.example.invalid/usdc.png",
                      },
                    },
                    token_info: {
                      symbol: "USDC",
                      balance: 15_000_000,
                      decimals: 6,
                      token_program: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                      verified: true,
                      spam: false,
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

    expect(portfolio.sol.logo).toBe("https://assets.example.invalid/sol.png");
    expect(portfolio.tokens).toEqual([
      expect.objectContaining({
        mint: "token-mint-1",
        name: "USD Coin (Devnet)",
        symbol: "USDC",
        logo: "https://assets.example.invalid/usdc.png",
        verified: true,
        spam: false,
      }),
    ]);
    expect(fetchMock.mock.calls.some(([target]) => target === "https://rpc.example.invalid")).toBe(
      true,
    );
  });
});
