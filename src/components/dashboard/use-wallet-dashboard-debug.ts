"use client";

import { useEffect } from "react";

import { debugLog, redactIdentifier } from "@/lib/offpay/debug";
import type { WebWalletCustody } from "@/lib/offpay/types";

export function useWalletDashboardDebug({
  activeWalletAddress,
  authenticated,
  connectedWalletAddresses,
  embeddedWalletCount,
  externalWalletCount,
  gatewayConfigured,
  preferredWalletCustody,
  privyReady,
  privyUserId,
  sessionReadState,
  sessionReady,
  signerReady,
  walletAddress,
  walletCount,
  walletCustody,
  walletsReady,
}: {
  activeWalletAddress: string | undefined;
  authenticated: boolean;
  connectedWalletAddresses: string;
  embeddedWalletCount: number;
  externalWalletCount: number;
  gatewayConfigured: boolean;
  preferredWalletCustody: WebWalletCustody | undefined;
  privyReady: boolean;
  privyUserId: string | undefined;
  sessionReadState: string;
  sessionReady: boolean;
  signerReady: boolean;
  walletAddress: string | undefined;
  walletCount: number;
  walletCustody: WebWalletCustody | undefined;
  walletsReady: boolean;
}) {
  useEffect(() => {
    debugLog("dashboard.wallet_state", {
      activeWallet: signerReady,
      activeWalletAddress: redactIdentifier(activeWalletAddress),
      authenticated,
      balancesFetchEnabled: gatewayConfigured && Boolean(walletAddress),
      custody: walletCustody,
      embeddedWalletCount,
      externalWalletCount,
      gatewayConfigured,
      preferredWalletCustody,
      privyUserId: redactIdentifier(privyUserId),
      ready: privyReady,
      sessionReadState,
      sessionReady,
      signerReady,
      connectedWalletAddresses: connectedWalletAddresses
        .split(",")
        .filter(Boolean)
        .map(redactIdentifier),
      walletAddress: redactIdentifier(walletAddress),
      walletCount,
      walletsReady,
    });
  }, [
    activeWalletAddress,
    authenticated,
    connectedWalletAddresses,
    embeddedWalletCount,
    externalWalletCount,
    gatewayConfigured,
    preferredWalletCustody,
    privyReady,
    privyUserId,
    sessionReadState,
    sessionReady,
    signerReady,
    walletAddress,
    walletCustody,
    walletCount,
    walletsReady,
  ]);
}
