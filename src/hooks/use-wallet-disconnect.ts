"use client";

import { useLogout, usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { useCallback, useState } from "react";

import { clearBrowserWalletSessionState } from "@/lib/offpay/browser-session-cleanup";
import { debugWarn } from "@/lib/offpay/debug";
import { getErrorMessage } from "@/lib/offpay/display";
import { clearStoredGatewaySession } from "@/lib/offpay/gateway-session-storage";
import {
  getGatewayOrigin,
  getPrivyAppId,
  getPublicSolanaCluster,
} from "@/lib/offpay/public-config";

export function useWalletDisconnect() {
  const { ready } = usePrivy();
  const { wallets } = useWallets();
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const cluster = getPublicSolanaCluster();
  const gatewayOrigin = getGatewayOrigin();
  const privyAppId = getPrivyAppId();

  const { logout } = useLogout({
    onSuccess: () => {
      void clearBrowserWalletSessionState({ privyAppId });

      if (!gatewayOrigin) {
        return;
      }

      wallets.forEach((wallet) => {
        clearStoredGatewaySession({
          gatewayOrigin,
          cluster,
          walletAddress: wallet.address,
        });
      });
    },
  });

  const disconnectAccount = useCallback(async () => {
    if (!ready || disconnecting) {
      return;
    }

    setDisconnecting(true);
    setDisconnectError(null);

    try {
      await clearBrowserWalletSessionState({ privyAppId });

      const disconnectResults = await Promise.allSettled(
        wallets.map((wallet) => wallet.disconnect()),
      );
      const failedDisconnects = disconnectResults.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failedDisconnects > 0) {
        debugWarn("wallet.disconnect.partial_failure", {
          failedDisconnects,
          walletCount: wallets.length,
        });
      }

      await clearBrowserWalletSessionState({ privyAppId });
      await logout();
      await clearBrowserWalletSessionState({ privyAppId });
    } catch (error: unknown) {
      const message = getErrorMessage(error);

      debugWarn("account.disconnect.failed", { error: message });
      setDisconnectError(message);
    } finally {
      setDisconnecting(false);
    }
  }, [disconnecting, logout, privyAppId, ready, wallets]);

  return {
    disconnectAccount,
    disconnectError,
    disconnecting,
  };
}
