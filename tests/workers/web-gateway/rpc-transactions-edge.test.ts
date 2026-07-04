import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWalletSignaturesFromRpc } from "../../../workers/web-gateway/src/rpc-transactions";

const walletAddress = "Wallet111111111111111111111111111111111111";
const rpcUrl = "https://rpc.example.invalid";

function rpcResponse(result: unknown): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: "test",
      result,
    }),
  );
}

describe("gateway RPC wallet transaction edge cases", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses current token-account ownership when transaction token balances omit owner", async () => {
    const tokenAccount = "TokenAccount111111111111111111111111111111";
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(String(init?.body)) as {
          method?: string;
          params?: unknown;
        };

        if (body.method === "getSignaturesForAddress") {
          return rpcResponse([
            {
              signature: "sig-ownerless-token-balance",
              slot: 125,
              err: null,
              memo: null,
              blockTime: 1_783_000_200,
              confirmationStatus: "finalized",
            },
          ]);
        }

        if (
          body.method === "getTokenAccountsByOwner" &&
          JSON.stringify(body.params).includes("Tokenkeg")
        ) {
          return rpcResponse({
            value: [
              {
                pubkey: tokenAccount,
                account: {
                  data: {
                    parsed: {
                      info: {
                        mint: "token-mint-ownerless",
                      },
                    },
                  },
                },
              },
            ],
          });
        }

        if (body.method === "getTokenAccountsByOwner") {
          return rpcResponse({ value: [] });
        }

        if (body.method === "getTransaction") {
          return rpcResponse({
            meta: {
              preBalances: [0],
              postBalances: [0],
              preTokenBalances: [
                {
                  accountIndex: 0,
                  mint: "token-mint-ownerless",
                  uiTokenAmount: {
                    amount: "1000000",
                    decimals: 6,
                  },
                },
              ],
              postTokenBalances: [
                {
                  accountIndex: 0,
                  mint: "token-mint-ownerless",
                  uiTokenAmount: {
                    amount: "2000000",
                    decimals: 6,
                  },
                },
              ],
            },
            transaction: {
              message: {
                accountKeys: [{ pubkey: tokenAccount }],
              },
            },
          });
        }

        if (body.method === "getAssetBatch") {
          return rpcResponse([
            {
              id: "token-mint-ownerless",
              content: {
                metadata: {
                  name: "Ownerless Metadata Token",
                  symbol: "OMT",
                },
                links: {
                  image: "https://assets.example.invalid/ownerless.png",
                },
              },
            },
          ]);
        }

        return rpcResponse(null);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const history = await fetchWalletSignaturesFromRpc({
      address: walletAddress,
      cluster: "solana:devnet",
      env: {
        HELIUS_DEVNET_RPC_URL: rpcUrl,
      },
      limit: 5,
    });

    expect(history.signatures[0]).toMatchObject({
      asset: expect.objectContaining({
        decimals: 6,
        mint: "token-mint-ownerless",
        rawAmountChange: "1000000",
        uiAmountChange: 1,
        name: "Ownerless Metadata Token",
        symbol: "OMT",
        logo: "https://assets.example.invalid/ownerless.png",
      }),
      summary: {
        kind: "received",
        label: "Received",
        tone: "positive",
      },
    });
  });

  it("falls back to parsed instruction mints when token balance arrays are empty", async () => {
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(String(init?.body)) as {
          method?: string;
        };

        if (body.method === "getSignaturesForAddress") {
          return rpcResponse([
            {
              signature: "sig-instruction-token",
              slot: 126,
              err: null,
              memo: null,
              blockTime: 1_783_000_300,
              confirmationStatus: "finalized",
            },
          ]);
        }

        if (body.method === "getTokenAccountsByOwner") {
          return rpcResponse({ value: [] });
        }

        if (body.method === "getTransaction") {
          return rpcResponse({
            meta: {
              preBalances: [0],
              postBalances: [0],
              preTokenBalances: [],
              postTokenBalances: [],
            },
            transaction: {
              message: {
                accountKeys: [{ pubkey: walletAddress }],
                instructions: [
                  {
                    parsed: {
                      info: {
                        authority: walletAddress,
                        mint: "token-mint-instruction",
                      },
                    },
                  },
                ],
              },
            },
          });
        }

        if (body.method === "getAssetBatch") {
          return rpcResponse([
            {
              id: "token-mint-instruction",
              content: {
                metadata: {
                  name: "Instruction Token",
                  symbol: "IXT",
                },
                links: {
                  image: "https://assets.example.invalid/instruction.png",
                },
              },
            },
          ]);
        }

        return rpcResponse(null);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const history = await fetchWalletSignaturesFromRpc({
      address: walletAddress,
      cluster: "solana:devnet",
      env: {
        HELIUS_DEVNET_RPC_URL: rpcUrl,
      },
      limit: 5,
    });

    expect(history.signatures[0]).toMatchObject({
      asset: expect.objectContaining({
        mint: "token-mint-instruction",
        name: "Instruction Token",
        symbol: "IXT",
        logo: "https://assets.example.invalid/instruction.png",
      }),
      assets: [
        expect.objectContaining({
          mint: "token-mint-instruction",
          name: "Instruction Token",
          symbol: "IXT",
          logo: "https://assets.example.invalid/instruction.png",
        }),
      ],
      summary: {
        kind: "unknown",
        label: "Activity",
        tone: "neutral",
      },
    });
  });
});
