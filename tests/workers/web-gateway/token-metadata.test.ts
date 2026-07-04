import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchFungibleAssetsByOwner,
  fetchTokenDisplayMetadataForCluster,
  fetchTokenDisplayMetadataBatch,
} from "../../../workers/web-gateway/src/token-metadata";
import { applyKnownTokenBalanceMetadata } from "../../../workers/web-gateway/src/known-token-metadata";

const rpcUrl = "https://rpc.example.invalid";
const devnetUsdcMint = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const offpayDevnetDusdcMint = "4oG4sjmopf5MzvTHLE8rpVJ2uyczxfsw2K84SUTpNDx7";

function rpcResponse(result: unknown): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: "test",
      result,
    }),
  );
}

function dasToken(id: string) {
  return {
    id,
    content: {
      metadata: {
        name: `Token ${id}`,
        symbol: id.toUpperCase(),
      },
      links: {
        image: `https://assets.example.invalid/${id}.png`,
      },
    },
    token_info: {
      balance: "1",
      decimals: 0,
      symbol: id.toUpperCase(),
    },
  };
}

describe("gateway DAS token metadata helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("paginates owner fungible asset metadata beyond the first DAS page", async () => {
    const firstPageItems = Array.from({ length: 1000 }, (_, index) =>
      dasToken(`token-${index}`),
    );
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(String(init?.body)) as {
          method?: string;
          params?: { page?: number };
        };

        expect(body.method).toBe("searchAssets");

        return rpcResponse({
          total: 1001,
          items: body.params?.page === 1 ? firstPageItems : [dasToken("token-1000")],
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const balances = await fetchFungibleAssetsByOwner(
      rpcUrl,
      "Wallet111111111111111111111111111111111111",
    );

    expect(balances).toHaveLength(1001);
    expect(balances?.[1000]).toMatchObject({
      mint: "token-1000",
      logo: "https://assets.example.invalid/token-1000.png",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("chunks getAssetBatch requests so every mint can resolve metadata", async () => {
    const seenBatchSizes: number[] = [];
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(String(init?.body)) as {
          method?: string;
          params?: { ids?: string[] };
        };
        const ids = body.params?.ids ?? [];

        expect(body.method).toBe("getAssetBatch");
        seenBatchSizes.push(ids.length);

        return rpcResponse(ids.map((id) => dasToken(id)));
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const mints = Array.from({ length: 101 }, (_, index) => `token-${index}`);
    const metadata = await fetchTokenDisplayMetadataBatch(rpcUrl, mints);

    expect(metadata.size).toBe(101);
    expect(seenBatchSizes).toEqual([100, 1]);
    expect(metadata.get("token-100")?.logo).toBe(
      "https://assets.example.invalid/token-100.png",
    );
  });

  it("fills known devnet token symbols when DAS metadata omits them", async () => {
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(String(init?.body)) as {
          method?: string;
          params?: { ids?: string[] };
        };
        const ids = body.params?.ids ?? [];

        expect(body.method).toBe("getAssetBatch");

        return rpcResponse(
          ids.map((id) => ({
            id,
            content:
              id === devnetUsdcMint
                ? { links: { image: "https://assets.example.invalid/usdc.png" } }
                : {},
          })),
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const metadata = await fetchTokenDisplayMetadataForCluster({
      cluster: "solana:devnet",
      env: { HELIUS_DEVNET_RPC_URL: rpcUrl },
      mints: [devnetUsdcMint, offpayDevnetDusdcMint],
    });

    expect(metadata.get(devnetUsdcMint)).toMatchObject({
      logo: "https://assets.example.invalid/usdc.png",
      name: "USD Coin (Devnet)",
      symbol: "USDC",
    });
    expect(metadata.get(offpayDevnetDusdcMint)).toMatchObject({
      name: "Devnet USDC",
      symbol: "dUSDC",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fills known devnet token symbols for balance rows", () => {
    const [token] = applyKnownTokenBalanceMetadata({
      cluster: "solana:devnet",
      env: {},
      tokens: [
        {
          amount: "12000000",
          decimals: 6,
          mint: offpayDevnetDusdcMint,
          uiAmount: 12,
          uiAmountString: "12",
        },
      ],
    });

    expect(token).toMatchObject({
      name: "Devnet USDC",
      symbol: "dUSDC",
    });
  });
});
