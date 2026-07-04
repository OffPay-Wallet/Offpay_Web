"use client";

import { useConnectWallet } from "@privy-io/react-auth";
import { Check, Copy, Unplug } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useSolanaWalletAccount } from "@/hooks/use-solana-wallet-account";
import { useWalletDisconnect } from "@/hooks/use-wallet-disconnect";
import { debugLog, debugWarn, redactIdentifier } from "@/lib/offpay/debug";
import { truncateAddress } from "@/lib/offpay/display";
import { cn } from "@/lib/utils";

type CopyStatus = "idle" | "copied" | "failed";

export function WalletAccountControl() {
  const { privyReady, walletAddress, walletsReady } = useSolanaWalletAccount();
  const { connectWallet } = useConnectWallet({
    onError: (error) => {
      debugWarn("wallet.connect.failed", {
        error: String(error),
      });
    },
    onSuccess: ({ wallet }) => {
      debugLog("wallet.connect.success", {
        walletAddress: redactIdentifier(wallet.address),
      });
    },
  });
  const { disconnectAccount, disconnectError, disconnecting } = useWalletDisconnect();
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const setTemporaryCopyStatus = (status: CopyStatus) => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    setCopyStatus(status);
    resetTimerRef.current = setTimeout(() => setCopyStatus("idle"), 1200);
  };

  const copyAddress = async () => {
    if (!walletAddress) {
      return;
    }

    try {
      await navigator.clipboard.writeText(walletAddress);
      setTemporaryCopyStatus("copied");
    } catch {
      setTemporaryCopyStatus("failed");
    }
  };

  if (!privyReady) {
    return null;
  }

  if (!walletAddress && !walletsReady) {
    return (
      <div className="flex h-9 items-center rounded-md border border-border bg-background px-3 font-sans text-xs font-semibold text-muted-foreground sm:h-10">
        Preparing wallet
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <button
        type="button"
        onClick={() => connectWallet()}
        className={cn(
          "flex h-9 items-center rounded-md border border-border bg-background px-3 sm:h-10",
          "font-sans text-xs font-semibold text-muted-foreground transition-colors",
          "hover:bg-secondary hover:text-foreground focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        Connect wallet
      </button>
    );
  }

  const addressLabel = truncateAddress(walletAddress);
  const CopyIcon = copyStatus === "copied" ? Check : Copy;
  const copyStatusMessage =
    copyStatus === "copied"
      ? "Wallet address copied"
      : copyStatus === "failed"
        ? "Copy failed"
        : null;

  return (
    <div className="min-w-0">
      <div
        className="inline-flex max-w-full items-center gap-1 font-sans text-xs font-bold text-foreground sm:gap-1.5 sm:text-sm"
        aria-label="Wallet account"
      >
        <span className="min-w-0 truncate px-1 font-sans tabular-nums">
          {addressLabel}
        </span>
        <button
          type="button"
          onClick={copyAddress}
          className={cn(
            "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground sm:h-9 sm:w-9",
            "transition-colors duration-150 hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            copyStatus === "copied" && "text-success",
          )}
          aria-label="Copy wallet address"
        >
          <CopyIcon className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => void disconnectAccount()}
          disabled={disconnecting}
          className={cn(
            "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-destructive sm:h-9 sm:w-9",
            "transition-colors duration-150 hover:bg-destructive/15",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50",
          )}
          aria-label="Disconnect wallet"
          aria-busy={disconnecting || undefined}
        >
          {disconnecting ? (
            <span
              className="h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Unplug className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {copyStatusMessage ? (
        <p className="sr-only" role="status">
          {copyStatusMessage}
        </p>
      ) : null}
      {disconnectError ? (
        <p className="sr-only" role="status">
          Disconnect failed: {disconnectError}
        </p>
      ) : null}
    </div>
  );
}
