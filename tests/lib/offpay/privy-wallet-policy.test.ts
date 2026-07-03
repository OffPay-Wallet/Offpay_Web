import { describe, expect, it } from "vitest";

import {
  linkedSolanaWalletAddressesForUser,
  preferredWalletCustodyForUser,
  shouldCreateSolanaEmbeddedWalletOnLogin,
} from "../../../src/lib/offpay/privy-wallet-policy";

const externalSolanaWallet = {
  type: "wallet",
  chainType: "solana",
  walletClientType: "phantom",
  address: "External1111111111111111111111111111111111",
  latestVerifiedAt: "2026-07-01T00:00:00.000Z",
};

const privySolanaWallet = {
  type: "wallet",
  chainType: "solana",
  walletClientType: "privy",
  address: "Privy111111111111111111111111111111111111",
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

  it("returns only the current user's linked Solana wallet addresses by custody", () => {
    const user = {
      linkedAccounts: [
        externalSolanaWallet,
        privySolanaWallet,
        {
          ...privySolanaWallet,
          walletClientType: "privy-v2",
          address: "Privy222222222222222222222222222222222222",
        },
        {
          type: "wallet",
          chainType: "ethereum",
          walletClientType: "metamask",
          address: "0x0000000000000000000000000000000000000000",
        },
        {
          type: "google_oauth",
          latestVerifiedAt: "2026-07-03T00:00:00.000Z",
        },
      ],
    };

    expect(linkedSolanaWalletAddressesForUser(user, "external-solana")).toEqual([
      "External1111111111111111111111111111111111",
    ]);
    expect(linkedSolanaWalletAddressesForUser(user, "privy-solana")).toEqual([
      "Privy111111111111111111111111111111111111",
      "Privy222222222222222222222222222222222222",
    ]);
    expect(linkedSolanaWalletAddressesForUser(user)).toEqual([
      "External1111111111111111111111111111111111",
      "Privy111111111111111111111111111111111111",
      "Privy222222222222222222222222222222222222",
    ]);
  });

  it("does not use the top-level Privy wallet as current-user ownership evidence", () => {
    const user = {
      linkedAccounts: [],
      wallet: externalSolanaWallet,
    };

    expect(linkedSolanaWalletAddressesForUser(user, "external-solana")).toEqual([]);
  });
});
