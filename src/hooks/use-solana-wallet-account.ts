"use client";

import { usePrivy } from "@privy-io/react-auth";
import {
  type ConnectedStandardSolanaWallet,
  useWallets,
} from "@privy-io/react-auth/solana";
import { useEffect, useMemo } from "react";

import { debugLog, redactIdentifier } from "@/lib/offpay/debug";
import {
  linkedSolanaWalletAddressesForUser,
  preferredWalletCustodyForUser,
} from "@/lib/offpay/privy-wallet-policy";
import {
  isPrivyEmbeddedSolanaWallet,
  walletCustodyForWallet,
} from "@/lib/offpay/solana-wallets";

function redactAddresses(addresses: string[]): string[] {
  return addresses.map((address) => redactIdentifier(address) ?? "[empty]");
}

export function useSolanaWalletAccount() {
  const {
    authenticated,
    ready: privyReady,
    user,
  } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const walletOwner = authenticated ? user : null;
  const privyUserId = walletOwner?.id;

  const externalWallets = useMemo(
    () => wallets.filter((wallet) => !isPrivyEmbeddedSolanaWallet(wallet)),
    [wallets],
  );
  const embeddedWallets = useMemo(
    () => wallets.filter((wallet) => isPrivyEmbeddedSolanaWallet(wallet)),
    [wallets],
  );
  const rawExternalWalletAddresses = useMemo(
    () => externalWallets.map((wallet) => wallet.address),
    [externalWallets],
  );
  const rawEmbeddedWalletAddresses = useMemo(
    () => embeddedWallets.map((wallet) => wallet.address),
    [embeddedWallets],
  );
  const linkedExternalWalletAddressList = useMemo(
    () => linkedSolanaWalletAddressesForUser(walletOwner, "external-solana"),
    [walletOwner],
  );
  const linkedEmbeddedWalletAddressList = useMemo(
    () => linkedSolanaWalletAddressesForUser(walletOwner, "privy-solana"),
    [walletOwner],
  );
  const linkedExternalWalletAddresses = useMemo(
    () => new Set(linkedExternalWalletAddressList),
    [linkedExternalWalletAddressList],
  );
  const linkedEmbeddedWalletAddresses = useMemo(
    () => new Set(linkedEmbeddedWalletAddressList),
    [linkedEmbeddedWalletAddressList],
  );
  const currentUserExternalWallets = useMemo(
    () => externalWallets.filter((wallet) => linkedExternalWalletAddresses.has(wallet.address)),
    [externalWallets, linkedExternalWalletAddresses],
  );
  const currentUserEmbeddedWallets = useMemo(
    () => embeddedWallets.filter((wallet) => linkedEmbeddedWalletAddresses.has(wallet.address)),
    [embeddedWallets, linkedEmbeddedWalletAddresses],
  );
  const currentUserWallets = useMemo(
    () => [...currentUserExternalWallets, ...currentUserEmbeddedWallets],
    [currentUserEmbeddedWallets, currentUserExternalWallets],
  );
  const currentUserExternalWalletAddresses = useMemo(
    () => currentUserExternalWallets.map((wallet) => wallet.address),
    [currentUserExternalWallets],
  );
  const currentUserEmbeddedWalletAddresses = useMemo(
    () => currentUserEmbeddedWallets.map((wallet) => wallet.address),
    [currentUserEmbeddedWallets],
  );
  const rejectedExternalWalletAddresses = useMemo(
    () => rawExternalWalletAddresses.filter((address) => !linkedExternalWalletAddresses.has(address)),
    [linkedExternalWalletAddresses, rawExternalWalletAddresses],
  );
  const rejectedEmbeddedWalletAddresses = useMemo(
    () => rawEmbeddedWalletAddresses.filter((address) => !linkedEmbeddedWalletAddresses.has(address)),
    [linkedEmbeddedWalletAddresses, rawEmbeddedWalletAddresses],
  );
  const preferredWalletCustody = useMemo(
    () => preferredWalletCustodyForUser(walletOwner),
    [walletOwner],
  );
  const activeWallet = useMemo<ConnectedStandardSolanaWallet | undefined>(() => {
    if (preferredWalletCustody === "external-solana") {
      return currentUserExternalWallets[0];
    }

    if (preferredWalletCustody === "privy-solana") {
      return currentUserEmbeddedWallets[0];
    }

    return undefined;
  }, [currentUserEmbeddedWallets, currentUserExternalWallets, preferredWalletCustody]);
  const walletAddress = activeWallet?.address;
  const walletCustody = walletCustodyForWallet(activeWallet);

  useEffect(() => {
    debugLog("wallet.account_filter", {
      activeWallet: Boolean(activeWallet),
      activeWalletAddress: redactIdentifier(walletAddress),
      authenticated,
      currentUserEmbeddedWalletAddresses: redactAddresses(currentUserEmbeddedWalletAddresses),
      currentUserExternalWalletAddresses: redactAddresses(currentUserExternalWalletAddresses),
      embeddedWalletCount: embeddedWallets.length,
      externalWalletCount: externalWallets.length,
      linkedEmbeddedWalletAddresses: redactAddresses(linkedEmbeddedWalletAddressList),
      linkedExternalWalletAddresses: redactAddresses(linkedExternalWalletAddressList),
      preferredWalletCustody,
      privyReady,
      privyUserId: redactIdentifier(privyUserId),
      rawEmbeddedWalletAddresses: redactAddresses(rawEmbeddedWalletAddresses),
      rawExternalWalletAddresses: redactAddresses(rawExternalWalletAddresses),
      rejectedEmbeddedWalletAddresses: redactAddresses(rejectedEmbeddedWalletAddresses),
      rejectedExternalWalletAddresses: redactAddresses(rejectedExternalWalletAddresses),
      walletCustody,
      walletsReady,
    });
  }, [
    activeWallet,
    authenticated,
    currentUserEmbeddedWalletAddresses,
    currentUserExternalWalletAddresses,
    embeddedWallets.length,
    externalWallets.length,
    linkedEmbeddedWalletAddressList,
    linkedExternalWalletAddressList,
    preferredWalletCustody,
    privyReady,
    privyUserId,
    rawEmbeddedWalletAddresses,
    rawExternalWalletAddresses,
    rejectedEmbeddedWalletAddresses,
    rejectedExternalWalletAddresses,
    walletAddress,
    walletCustody,
    walletsReady,
  ]);

  return {
    authenticated,
    activeWallet,
    activeWalletAddress: walletAddress,
    connectedWalletAddresses: currentUserWallets.map((wallet) => wallet.address).join(","),
    embeddedWalletCount: currentUserEmbeddedWallets.length,
    embeddedWallets: currentUserEmbeddedWallets,
    externalWalletCount: currentUserExternalWallets.length,
    externalWallets: currentUserExternalWallets,
    preferredWalletCustody,
    privyUserId,
    privyReady,
    signerReady: Boolean(activeWallet),
    walletAddress,
    walletCount: currentUserWallets.length,
    walletCustody,
    wallets: currentUserWallets,
    walletsReady,
  };
}
