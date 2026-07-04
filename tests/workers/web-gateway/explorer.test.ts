import { describe, expect, it } from "vitest";

import { buildTransactionExplorerUrl } from "../../../workers/web-gateway/src/explorer";

describe("gateway explorer links", () => {
  it("builds transaction history paths from cluster-specific Worker templates", () => {
    const env = {
      OFFPAY_SOLANA_DEVNET_EXPLORER_TX_URL_TEMPLATE:
        "/devnet/tx/{signature}{clusterQuery}",
      OFFPAY_SOLANA_MAINNET_EXPLORER_TX_URL_TEMPLATE:
        "/mainnet/tx/{signature}/history{clusterQuery}",
      OFFPAY_SOLANA_TESTNET_EXPLORER_TX_URL_TEMPLATE:
        "/testnet/tx/{signature}{clusterQuery}",
    };

    expect(
      buildTransactionExplorerUrl({
        cluster: "solana:mainnet",
        env,
        signature: "mainnet-signature",
      }),
    ).toBe("/mainnet/tx/mainnet-signature/history?cluster=mainnet-beta");
    expect(
      buildTransactionExplorerUrl({
        cluster: "solana:devnet",
        env,
        signature: "devnet-signature",
      }),
    ).toBe("/devnet/tx/devnet-signature?cluster=devnet");
    expect(
      buildTransactionExplorerUrl({
        cluster: "solana:testnet",
        env,
        signature: "testnet-signature",
      }),
    ).toBe("/testnet/tx/testnet-signature?cluster=testnet");
  });

  it("omits transaction links when the cluster template is missing", () => {
    expect(
      buildTransactionExplorerUrl({
        cluster: "solana:devnet",
        env: {},
        signature: "fallback-signature",
      }),
    ).toBeNull();
  });
});
