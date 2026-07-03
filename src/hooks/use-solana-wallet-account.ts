"use client";

import { usePrivy } from "@privy-io/react-auth";
import {
  type ConnectedStandardSolanaWallet,
  useWallets,
} from "@privy-io/react-auth/solana";
import { useMemo } from "react";

import { preferredWalletCustodyForUser } from "@/lib/offpay/privy-wallet-policy";
import {
  isPrivyEmbeddedSolanaWallet,
  walletCustodyForWallet,
} from "@/lib/offpay/solana-wallets";

export function useSolanaWalletAccount() {
  const {
    authenticated,
    ready: privyReady,
    user,
  } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();

  const externalWallets = useMemo(
    () => wallets.filter((wallet) => !isPrivyEmbeddedSolanaWallet(wallet)),
    [wallets],
  );
  const embeddedWallets = useMemo(
    () => wallets.filter((wallet) => isPrivyEmbeddedSolanaWallet(wallet)),
    [wallets],
  );
  const preferredWalletCustody = useMemo(() => preferredWalletCustodyForUser(user), [user]);
  const activeWallet = useMemo<ConnectedStandardSolanaWallet | undefined>(() => {
    if (preferredWalletCustody === "external-solana") {
      return externalWallets[0];
    }

    if (preferredWalletCustody === "privy-solana") {
      return embeddedWallets[0];
    }

    return undefined;
  }, [embeddedWallets, externalWallets, preferredWalletCustody]);
  const walletAddress = activeWallet?.address;

  return {
    authenticated,
    activeWallet,
    activeWalletAddress: walletAddress,
    connectedWalletAddresses: wallets.map((wallet) => wallet.address).join(","),
    embeddedWalletCount: embeddedWallets.length,
    embeddedWallets,
    externalWalletCount: externalWallets.length,
    externalWallets,
    preferredWalletCustody,
    privyReady,
    signerReady: Boolean(activeWallet),
    walletAddress,
    walletCount: wallets.length,
    walletCustody: walletCustodyForWallet(activeWallet),
    wallets,
    walletsReady,
  };
}
