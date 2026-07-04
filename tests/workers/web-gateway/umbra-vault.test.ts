import { describe, expect, it, vi } from "vitest";

import {
  readUmbraVaultHoldings,
  UmbraVaultGatewayError,
} from "../../../workers/web-gateway/src/umbra-vault";

const identity = {
  address: "11111111111111111111111111111111",
  cluster: "solana:devnet" as const,
};

const env = {
  UMBRA_RELAYER_URL_DEVNET: "https://relayer.devnet.example.invalid",
};

describe("gateway Umbra vault holdings", () => {
  it("syncs supported encrypted token rows from the relayer", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        active_stealth_pool_indices: ["0", "1"],
        address: "Relayer111111111111111111111111111111111",
        supported_mints: [
          "So11111111111111111111111111111111111111112",
          "4oG4sjmopf5MzvTHLE8rpVJ2uyczxfsw2K84SUTpNDx7",
        ],
      }),
    );

    const holdings = await readUmbraVaultHoldings({
      env,
      fetchImpl: fetchMock as unknown as typeof fetch,
      identity,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://relayer.devnet.example.invalid/v1/relayer/info",
      {
        headers: { accept: "application/json" },
        method: "GET",
      },
    );
    expect(holdings).toMatchObject({
      activeStealthPoolIndices: ["0", "1"],
      address: identity.address,
      cluster: "solana:devnet",
      network: "devnet",
      relayerSync: {
        source: "relayer",
      },
      relayerAddress: "Relayer111111111111111111111111111111111",
      supportedMintCount: 2,
    });
    expect(holdings.holdings).toEqual([
      expect.objectContaining({
        balanceLabel: "Encrypted",
        balanceState: "encrypted",
        depositEnabled: true,
        encrypted: true,
        symbol: "wSOL",
      }),
      expect.objectContaining({
        balanceLabel: "Encrypted",
        balanceState: "encrypted",
        depositEnabled: true,
        encrypted: true,
        symbol: "dUSDC",
      }),
    ]);
  });

  it("reports missing relayer binding before calling the relayer", async () => {
    const fetchMock = vi.fn();

    await expect(
      readUmbraVaultHoldings({
        env: {},
        fetchImpl: fetchMock as unknown as typeof fetch,
        identity,
      }),
    ).rejects.toMatchObject<UmbraVaultGatewayError>({
      code: "umbra_relayer_missing",
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to metadata rows when the relayer returns an upstream error", async () => {
    const fetchMock = vi.fn(async () => new Response("not found", {
      status: 404,
      statusText: "Not Found",
    }));

    const holdings = await readUmbraVaultHoldings({
      env,
      fetchImpl: fetchMock as unknown as typeof fetch,
      identity,
    });

    expect(holdings).toMatchObject({
      activeStealthPoolIndices: [],
      relayerAddress: null,
      relayerSync: {
        reason: "http_status",
        source: "metadata_fallback",
        upstreamStatus: 404,
      },
      supportedMintCount: 3,
    });
    expect(holdings.holdings.map((holding) => holding.symbol)).toEqual(["wSOL", "dUSDC", "dUSDT"]);
  });

  it("falls back to metadata rows when the relayer host cannot be reached", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    const holdings = await readUmbraVaultHoldings({
      env,
      fetchImpl: fetchMock as unknown as typeof fetch,
      identity,
    });

    expect(holdings).toMatchObject({
      relayerSync: {
        reason: "network_error",
        source: "metadata_fallback",
      },
      supportedMintCount: 3,
    });
  });
});
