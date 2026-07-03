import { describe, expect, it } from "vitest";

import {
  preferredWalletCustodyForUser,
  shouldCreateSolanaEmbeddedWalletOnLogin,
} from "../../../src/lib/offpay/privy-wallet-policy";

const externalSolanaWallet = {
  type: "wallet",
  chainType: "solana",
  walletClientType: "phantom",
  latestVerifiedAt: "2026-07-01T00:00:00.000Z",
};

const privySolanaWallet = {
  type: "wallet",
  chainType: "solana",
  walletClientType: "privy",
  latestVerifiedAt: "2026-07-01T00:00:00.000Z",
};

describe("Privy wallet policy", () => {
  it("prefers the embedded Solana wallet after a newer Google login", () => {
    const user = {
      linkedAccounts: [
        externalSolanaWallet,
        privySolanaWallet,
        {
          type: "google_oauth",
          latestVerifiedAt: "2026-07-03T00:00:00.000Z",
        },
      ],
    };

    expect(preferredWalletCustodyForUser(user)).toBe("privy-solana");
    expect(shouldCreateSolanaEmbeddedWalletOnLogin({ user })).toBe(false);
  });

  it("does not fall back to a stale external wallet while embedded creation is pending", () => {
    const user = {
      linkedAccounts: [
        externalSolanaWallet,
        {
          type: "google_oauth",
          latestVerifiedAt: "2026-07-03T00:00:00.000Z",
        },
      ],
    };

    expect(preferredWalletCustodyForUser(user)).toBeUndefined();
    expect(shouldCreateSolanaEmbeddedWalletOnLogin({ user })).toBe(true);
  });

  it("uses the external wallet when wallet login is the latest verification", () => {
    const user = {
      linkedAccounts: [
        {
          ...privySolanaWallet,
          latestVerifiedAt: "2026-07-01T00:00:00.000Z",
        },
        {
          ...externalSolanaWallet,
          latestVerifiedAt: "2026-07-03T00:00:00.000Z",
        },
      ],
    };

    expect(preferredWalletCustodyForUser(user)).toBe("external-solana");
    expect(shouldCreateSolanaEmbeddedWalletOnLogin({ user })).toBe(false);
  });
});
