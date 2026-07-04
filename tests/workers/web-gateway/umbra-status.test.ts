import { describe, expect, it } from "vitest";

import { readUmbraGatewayStatus } from "../../../workers/web-gateway/src/umbra-status";

describe("gateway Umbra status", () => {
  it("requires only the active cluster Umbra bindings plus runtime settings", () => {
    const status = readUmbraGatewayStatus(
      {
        UMBRA_CIRCUIT_VERSION: "v1",
        UMBRA_INDEXER_URL_DEVNET: "https://indexer.devnet.example.invalid",
        UMBRA_LOCAL_TEST_MODE: "false",
        UMBRA_MIN_SDK_VERSION: "5.0.0-rc.6",
        UMBRA_RELAYER_URL_DEVNET: "https://relayer.devnet.example.invalid",
      },
      "solana:devnet",
    );

    expect(status).toMatchObject({
      configured: true,
      missing: [],
      network: "devnet",
      services: {
        indexer: true,
        relayer: true,
        runtime: true,
      },
      supported: true,
    });
  });

  it("reports missing server-side bindings without exposing values", () => {
    const status = readUmbraGatewayStatus(
      {
        UMBRA_INDEXER_URL_MAINNET: "https://indexer.mainnet.example.invalid",
      },
      "solana:mainnet",
    );

    expect(status.configured).toBe(false);
    expect(status.missing).toEqual([
      "UMBRA_RELAYER_URL_MAINNET",
      "UMBRA_CIRCUIT_VERSION",
      "UMBRA_MIN_SDK_VERSION",
      "UMBRA_LOCAL_TEST_MODE",
    ]);
  });

  it("marks testnet unsupported", () => {
    const status = readUmbraGatewayStatus({}, "solana:testnet");

    expect(status).toMatchObject({
      configured: false,
      missing: [],
      network: null,
      supported: false,
    });
  });
});
