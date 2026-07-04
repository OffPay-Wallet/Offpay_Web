import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWalletSignaturesFromRpc } from "../../../workers/web-gateway/src/rpc-transactions";

const walletAddress = "Wallet111111111111111111111111111111111111";
const rpcUrl = "https://rpc.example.invalid";
const devnetUmbraProgramId = "DSuKkyqGVGgo4QtPABfxKJKygUDACbUhirnuv63mEpAJ";

function rpcResponse(result: unknown): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: "test",
      result,
    }),
  );
}

describe("gateway RPC wallet transaction classification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("classifies swaps from opposite signed token deltas", async () => {
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(String(init?.body)) as { method?: string; params?: unknown };

        if (body.method === "getSignaturesForAddress") {
          return rpcResponse([
            {
              signature: "sig-swap",
              slot: 127,
              err: null,
              memo: null,
              blockTime: 1_783_000_400,
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
              preTokenBalances: [
                {
                  accountIndex: 0,
                  mint: "token-mint-sell",
                  owner: walletAddress,
                  uiTokenAmount: { amount: "1000000", decimals: 6 },
                },
                {
                  accountIndex: 1,
                  mint: "token-mint-buy",
                  owner: walletAddress,
                  uiTokenAmount: { amount: "0", decimals: 6 },
                },
              ],
              postTokenBalances: [
                {
                  accountIndex: 0,
                  mint: "token-mint-sell",
                  owner: walletAddress,
                  uiTokenAmount: { amount: "0", decimals: 6 },
                },
                {
                  accountIndex: 1,
                  mint: "token-mint-buy",
                  owner: walletAddress,
                  uiTokenAmount: { amount: "2500000", decimals: 6 },
                },
              ],
            },
            transaction: {
              message: {
                accountKeys: [{ pubkey: "SellTokenAccount" }, { pubkey: "BuyTokenAccount" }],
              },
            },
          });
        }

        if (body.method === "getAssetBatch") {
          expect(body.params).toEqual({ ids: ["token-mint-sell", "token-mint-buy"] });

          return rpcResponse([
            {
              id: "token-mint-sell",
              content: { metadata: { name: "Sell Token", symbol: "SELL" } },
            },
            {
              id: "token-mint-buy",
              content: { metadata: { name: "Buy Token", symbol: "BUY" } },
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
      env: { HELIUS_DEVNET_RPC_URL: rpcUrl },
      limit: 5,
    });

    expect(history.signatures[0]).toMatchObject({
      summary: {
        kind: "swapped",
        label: "Swapped",
        tone: "neutral",
      },
      assets: [
        expect.objectContaining({
          mint: "token-mint-sell",
          rawAmountChange: "-1000000",
          uiAmountChange: -1,
          symbol: "SELL",
        }),
        expect.objectContaining({
          mint: "token-mint-buy",
          rawAmountChange: "2500000",
          uiAmountChange: 2.5,
          symbol: "BUY",
        }),
      ],
    });
  });

  it("classifies Umbra vault deposits and withdrawals from program touches", async () => {
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(String(init?.body)) as { method?: string; params?: unknown[] };
        const signature = body.params?.[0];

        if (body.method === "getSignaturesForAddress") {
          return rpcResponse([
            {
              signature: "sig-shield",
              slot: 128,
              err: null,
              memo: "public_balance_to_encrypted",
              blockTime: 1_783_000_500,
              confirmationStatus: "finalized",
            },
            {
              signature: "sig-unshield",
              slot: 129,
              err: null,
              memo: "encrypted_balance_to_public",
              blockTime: 1_783_000_600,
              confirmationStatus: "finalized",
            },
          ]);
        }

        if (body.method === "getTokenAccountsByOwner") {
          return rpcResponse({ value: [] });
        }

        if (body.method === "getTransaction") {
          const shield = signature === "sig-shield";
          return rpcResponse({
            meta: {
              preBalances: [0],
              postBalances: [0],
              preTokenBalances: [
                {
                  accountIndex: 0,
                  mint: "token-mint-umbra",
                  owner: walletAddress,
                  uiTokenAmount: { amount: shield ? "15000000" : "0", decimals: 6 },
                },
              ],
              postTokenBalances: [
                {
                  accountIndex: 0,
                  mint: "token-mint-umbra",
                  owner: walletAddress,
                  uiTokenAmount: { amount: shield ? "0" : "7000000", decimals: 6 },
                },
              ],
            },
            transaction: {
              message: {
                accountKeys: [{ pubkey: "UmbraTokenAccount" }, { pubkey: devnetUmbraProgramId }],
                instructions: [
                  {
                    programId: devnetUmbraProgramId,
                    parsed: {
                      type: shield
                        ? "public_balance_to_encrypted"
                        : "encrypted_balance_to_public",
                    },
                  },
                ],
              },
            },
          });
        }

        if (body.method === "getAssetBatch") {
          expect(body.params).toEqual({ ids: ["token-mint-umbra"] });

          return rpcResponse([
            {
              id: "token-mint-umbra",
              content: { metadata: { name: "Umbra Token", symbol: "UMB" } },
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
      env: { HELIUS_DEVNET_RPC_URL: rpcUrl },
      limit: 5,
    });

    expect(history.signatures[0]).toMatchObject({
      signature: "sig-shield",
      summary: {
        kind: "shielded",
        label: "Shielded",
        tone: "negative",
      },
      asset: expect.objectContaining({
        rawAmountChange: "-15000000",
        uiAmountChange: -15,
      }),
    });
    expect(history.signatures[1]).toMatchObject({
      signature: "sig-unshield",
      summary: {
        kind: "unshielded",
        label: "Unshielded",
        tone: "positive",
      },
      asset: expect.objectContaining({
        rawAmountChange: "7000000",
        uiAmountChange: 7,
      }),
    });
  });
});
