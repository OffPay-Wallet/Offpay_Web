"use client";

import { Check, Copy, Unplug } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useSolanaWalletAccount } from "@/hooks/use-solana-wallet-account";
import { useWalletDisconnect } from "@/hooks/use-wallet-disconnect";
import { truncateAddress } from "@/lib/offpay/display";
import { cn } from "@/lib/utils";

type CopyStatus = "idle" | "copied" | "failed";

export function WalletAccountControl() {
  const { privyReady, walletAddress } = useSolanaWalletAccount();
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

  if (!walletAddress) {
    return (
      <div className="flex h-10 items-center rounded-md border border-border bg-background px-3 font-sans text-xs font-semibold text-muted-foreground">
        Preparing wallet
      </div>
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
        className="inline-flex max-w-full items-center gap-5 font-sans text-xs font-bold text-foreground"
        aria-label="Wallet account"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate font-sans tabular-nums">
            {addressLabel}
          </span>
          <button
            type="button"
            onClick={copyAddress}
            className={cn(
              "flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-foreground",
              "transition-colors duration-150 focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              copyStatus === "copied" && "text-success",
            )}
            aria-label="Copy wallet address"
          >
            <CopyIcon
              className={cn(
                "h-4 w-4",
                copyStatus === "copied" && "motion-safe:animate-bounce",
              )}
              aria-hidden="true"
            />
          </button>
        </div>
        <button
          type="button"
          onClick={() => void disconnectAccount()}
          disabled={disconnecting}
          className={cn(
            "flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm text-destructive",
            "transition-colors duration-150",
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
