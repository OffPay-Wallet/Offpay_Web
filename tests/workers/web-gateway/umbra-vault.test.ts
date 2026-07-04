import { describe, expect, it, vi } from "vitest";

import type { WebWalletIdentity } from "../../../src/lib/offpay/types";
import {
  readUmbraVaultHoldings,
  UmbraVaultGatewayError,
} from "../../../workers/web-gateway/src/umbra-vault";

const identity: WebWalletIdentity = {
  address: "11111111111111111111111111111111",
  cluster: "solana:devnet",
  custody: "external-solana",
};

const env = {
  UMBRA_CIRCUIT_VERSION: "V18",
  UMBRA_INDEXER_URL_DEVNET: "https://indexer.devnet.example.invalid",
  UMBRA_LOCAL_TEST_MODE: "false",
  UMBRA_MIN_SDK_VERSION: "5.0.0-rc.6",
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

  it("reports missing Worker bindings before calling the relayer", async () => {
    const fetchMock = vi.fn();

    await expect(
      readUmbraVaultHoldings({
        env: {},
        fetchImpl: fetchMock as unknown as typeof fetch,
        identity,
      }),
    ).rejects.toMatchObject<UmbraVaultGatewayError>({
      code: "umbra_config_missing",
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
