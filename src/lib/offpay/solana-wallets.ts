import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";

import type { WebWalletCustody } from "./types";

export function isPrivyEmbeddedSolanaWallet(wallet: ConnectedStandardSolanaWallet): boolean {
  return Boolean((wallet.standardWallet as { isPrivyWallet?: boolean }).isPrivyWallet);
}

export function walletCustodyForWallet(
  wallet?: ConnectedStandardSolanaWallet,
): WebWalletCustody | undefined {
  if (!wallet) {
    return undefined;
  }

  return isPrivyEmbeddedSolanaWallet(wallet) ? "privy-solana" : "external-solana";
}

export function formatWalletCustody(custody?: WebWalletCustody): string | null {
  if (custody === "privy-solana") {
    return "Privy Solana";
  }

  if (custody === "external-solana") {
    return "External Solana";
  }

  return null;
}
