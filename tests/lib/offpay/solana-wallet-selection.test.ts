import { describe, expect, it } from "vitest";

import { selectSolanaWalletCandidates } from "../../../src/lib/offpay/solana-wallet-selection";

const externalWallet = { address: "External1111111111111111111111111111111111" };
const embeddedWallet = { address: "Privy111111111111111111111111111111111111" };

describe("Solana wallet selection", () => {
  it("prefers a linked wallet for the requested custody", () => {
    const selection = selectSolanaWalletCandidates({
      embeddedWallets: [embeddedWallet],
      externalWallets: [externalWallet],
      linkedEmbeddedWalletAddresses: [],
      linkedExternalWalletAddresses: [externalWallet.address],
      preferredWalletCustody: "external-solana",
    });

    expect(selection.activeWallet).toBe(externalWallet);
    expect(selection.activeWalletSource).toBe("linked");
    expect(selection.wallets).toEqual([externalWallet, embeddedWallet]);
  });

  it("falls back to connected embedded wallets while Privy linked accounts settle", () => {
    const selection = selectSolanaWalletCandidates({
      embeddedWallets: [embeddedWallet],
      externalWallets: [],
      linkedEmbeddedWalletAddresses: [],
      linkedExternalWalletAddresses: [],
      preferredWalletCustody: undefined,
    });

    expect(selection.activeWallet).toBe(embeddedWallet);
    expect(selection.activeWalletSource).toBe("connected");
    expect(selection.wallets).toEqual([embeddedWallet]);
  });

  it("falls back to a connected native wallet when no linked wallet is visible", () => {
    const selection = selectSolanaWalletCandidates({
      embeddedWallets: [],
      externalWallets: [externalWallet],
      linkedEmbeddedWalletAddresses: [],
      linkedExternalWalletAddresses: [],
      preferredWalletCustody: undefined,
    });

    expect(selection.activeWallet).toBe(externalWallet);
    expect(selection.activeWalletSource).toBe("connected");
    expect(selection.wallets).toEqual([externalWallet]);
  });
});
