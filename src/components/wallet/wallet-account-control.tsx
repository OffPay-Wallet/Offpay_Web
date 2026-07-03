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
      <div className="flex h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-medium text-muted-foreground">
        Preparing wallet
      </div>
    );
  }

  const copyLabel =
    copyStatus === "copied"
      ? "Copied"
      : copyStatus === "failed"
        ? "Copy failed"
        : truncateAddress(walletAddress);
  const CopyIcon = copyStatus === "copied" ? Check : Copy;

  return (
    <div className="min-w-0">
      <div
        className="inline-flex max-w-full overflow-hidden rounded-full border border-border bg-background shadow-sm"
        aria-label="Wallet account"
      >
        <button
          type="button"
          onClick={copyAddress}
          className={cn(
            "flex h-11 min-w-0 max-w-[13rem] items-center gap-2 bg-foreground px-4 text-background",
            "text-sm font-bold transition-colors duration-150 focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            copyStatus === "copied" && "bg-emerald-700 text-white dark:bg-emerald-500 dark:text-background",
          )}
          title="Copy wallet address"
          aria-label="Copy wallet address"
        >
          <span
            className="min-w-0 truncate font-mono tabular-nums"
            aria-live="polite"
          >
            {copyLabel}
          </span>
          <CopyIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => void disconnectAccount()}
          disabled={disconnecting}
          className={cn(
            "flex h-11 items-center gap-2 border-l border-border px-3 text-sm font-semibold",
            "text-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
          aria-label="Disconnect wallet"
          aria-busy={disconnecting || undefined}
          title={disconnectError ?? "Disconnect wallet"}
        >
          {disconnecting ? (
            <span
              className="h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Unplug className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">Disconnect</span>
        </button>
      </div>
      {disconnectError ? (
        <p className="sr-only" role="status">
          Disconnect failed: {disconnectError}
        </p>
      ) : null}
    </div>
  );
}
