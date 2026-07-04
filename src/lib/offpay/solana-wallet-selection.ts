import type { WebWalletCustody } from "./types";

export type SolanaWalletCandidate = {
  address: string;
};

export type SolanaWalletSelectionSource = "connected" | "linked" | "none";

export type SolanaWalletSelection<TWallet extends SolanaWalletCandidate> = {
  activeWallet: TWallet | undefined;
  activeWalletSource: SolanaWalletSelectionSource;
  embeddedWallets: TWallet[];
  externalWallets: TWallet[];
  wallets: TWallet[];
};

function linkedWallets<TWallet extends SolanaWalletCandidate>(
  wallets: TWallet[],
  linkedAddresses: readonly string[],
): TWallet[] {
  const linkedAddressSet = new Set(linkedAddresses);
  return wallets.filter((wallet) => linkedAddressSet.has(wallet.address));
}

function selectionSource<TWallet extends SolanaWalletCandidate>({
  activeWallet,
  linkedEmbeddedWallets,
  linkedExternalWallets,
}: {
  activeWallet: TWallet | undefined;
  linkedEmbeddedWallets: TWallet[];
  linkedExternalWallets: TWallet[];
}): SolanaWalletSelectionSource {
  if (!activeWallet) return "none";
  if (
    linkedExternalWallets.includes(activeWallet) ||
    linkedEmbeddedWallets.includes(activeWallet)
  ) {
    return "linked";
  }

  return "connected";
}

export function selectSolanaWalletCandidates<TWallet extends SolanaWalletCandidate>({
  embeddedWallets,
  externalWallets,
  linkedEmbeddedWalletAddresses,
  linkedExternalWalletAddresses,
  preferredWalletCustody,
}: {
  embeddedWallets: TWallet[];
  externalWallets: TWallet[];
  linkedEmbeddedWalletAddresses: readonly string[];
  linkedExternalWalletAddresses: readonly string[];
  preferredWalletCustody: WebWalletCustody | undefined;
}): SolanaWalletSelection<TWallet> {
  const linkedExternalWallets = linkedWallets(externalWallets, linkedExternalWalletAddresses);
  const linkedEmbeddedWallets = linkedWallets(embeddedWallets, linkedEmbeddedWalletAddresses);
  const visibleExternalWallets = linkedExternalWallets.length > 0
    ? linkedExternalWallets
    : externalWallets;
  const visibleEmbeddedWallets = linkedEmbeddedWallets.length > 0
    ? linkedEmbeddedWallets
    : embeddedWallets;
  const activeWallet = (() => {
    if (preferredWalletCustody === "external-solana") {
      return (
        linkedExternalWallets[0] ??
        externalWallets[0] ??
        linkedEmbeddedWallets[0] ??
        embeddedWallets[0]
      );
    }

    if (preferredWalletCustody === "privy-solana") {
      return (
        linkedEmbeddedWallets[0] ??
        embeddedWallets[0] ??
        linkedExternalWallets[0] ??
        externalWallets[0]
      );
    }

    return (
      linkedEmbeddedWallets[0] ??
      linkedExternalWallets[0] ??
      embeddedWallets[0] ??
      externalWallets[0]
    );
  })();

  return {
    activeWallet,
    activeWalletSource: selectionSource({
      activeWallet,
      linkedEmbeddedWallets,
      linkedExternalWallets,
    }),
    embeddedWallets: visibleEmbeddedWallets,
    externalWallets: visibleExternalWallets,
    wallets: [...visibleExternalWallets, ...visibleEmbeddedWallets],
  };
}
