import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWalletSignaturesFromRpc } from "../../../workers/web-gateway/src/rpc-transactions";
import { nativeSolMint } from "../../../workers/web-gateway/src/token-metadata";

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

describe("gateway RPC wallet transaction adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches token metadata logos from DAS to history signatures", async () => {
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(String(init?.body)) as {
          method?: string;
          params?: unknown;
        };

        if (body.method === "getSignaturesForAddress") {
          return rpcResponse([
            {
              signature: "sig-token",
              slot: 123,
              err: null,
              memo: null,
              blockTime: 1_783_000_000,
              confirmationStatus: "finalized",
            },
          ]);
        }

        if (body.method === "getTransaction") {
          return rpcResponse({
            meta: {
              preBalances: [0],
              postBalances: [0],
              preTokenBalances: [
                {
                  accountIndex: 0,
                  mint: "token-mint-1",
                  owner: walletAddress,
                  uiTokenAmount: {
                    amount: "1000000",
                    decimals: 6,
                    uiAmount: 1,
                    uiAmountString: "1",
                  },
                },
              ],
              postTokenBalances: [
                {
                  accountIndex: 0,
                  mint: "token-mint-1",
                  owner: walletAddress,
                  uiTokenAmount: {
                    amount: "1500000",
                    decimals: 6,
                    uiAmount: 1.5,
                    uiAmountString: "1.5",
                  },
                },
              ],
            },
            transaction: {
              message: {
                accountKeys: [{ pubkey: "TokenAccount111111111111111111111111111" }],
              },
            },
          });
        }

        if (body.method === "getAssetBatch") {
          expect(body.params).toEqual({ ids: ["token-mint-1"] });

          return rpcResponse([
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
        OFFPAY_SOLANA_DEVNET_EXPLORER_TX_URL_TEMPLATE:
          "/tx/{signature}{clusterQuery}",
      },
      limit: 5,
    });

    expect(history.signatures).toEqual([
      expect.objectContaining({
        signature: "sig-token",
        explorerUrl: "/tx/sig-token?cluster=devnet",
        asset: expect.objectContaining({
          decimals: 6,
          mint: "token-mint-1",
          rawAmountChange: "500000",
          uiAmountChange: 0.5,
          name: "USD Coin (Devnet)",
          symbol: "USDC",
          logo: "https://assets.example.invalid/usdc.png",
        }),
        summary: {
          kind: "received",
          label: "Received",
          tone: "positive",
        },
      }),
    ]);
  });

  it("uses native SOL metadata when the wallet SOL balance changed", async () => {
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(String(init?.body)) as {
          method?: string;
          params?: unknown;
        };

        if (body.method === "getSignaturesForAddress") {
          return rpcResponse([
            {
              signature: "sig-sol",
              slot: 124,
              err: null,
              memo: null,
              blockTime: 1_783_000_100,
              confirmationStatus: "finalized",
            },
          ]);
        }

        if (body.method === "getTransaction") {
          return rpcResponse({
            meta: {
              fee: 5000,
              preBalances: [2_000_000_000],
              postBalances: [1_499_995_000],
              preTokenBalances: [],
              postTokenBalances: [],
            },
            transaction: {
              message: {
                accountKeys: [{ pubkey: walletAddress }],
                instructions: [
                  {
                    programId: "11111111111111111111111111111111",
                    parsed: {
                      type: "transfer",
                      info: {
                        source: walletAddress,
                        destination: "Recipient111111111111111111111111111111111",
                        lamports: 500_000_000,
                      },
                    },
                  },
                ],
              },
            },
          });
        }

        if (body.method === "getAssetBatch") {
          expect(body.params).toEqual({ ids: [nativeSolMint] });

          return rpcResponse([
            {
              id: nativeSolMint,
              content: {
                metadata: {
                  name: "Wrapped SOL",
                  symbol: "SOL",
                },
                links: {
                  image: "https://assets.example.invalid/sol.png",
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
      signature: "sig-sol",
      asset: expect.objectContaining({
        decimals: 9,
        mint: nativeSolMint,
        rawAmountChange: "-500000000",
        uiAmountChange: -0.5,
        name: "Wrapped SOL",
        symbol: "SOL",
        logo: "https://assets.example.invalid/sol.png",
      }),
      summary: {
        kind: "sent",
        label: "Sent",
        tone: "negative",
      },
    });
  });

});
