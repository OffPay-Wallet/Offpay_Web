"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  ReceiptText,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AssetAvatar } from "@/components/dashboard/asset-avatar";
import {
  amountToneClass,
  formatRelativeTime,
  formatTransactionAmount,
  shortenSignature,
} from "@/components/dashboard/history-format";
import { Button } from "@/components/ui/button";
import { readGatewayWalletTransactions } from "@/lib/offpay/gateway-client";
import type { SolanaCluster, WalletTransactionSignature } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

const pageSize = 5;
type CopyStatus = "copied" | "failed";

function HistoryEntryIcon({ entry }: { entry: WalletTransactionSignature }) {
  const logoAsset =
    entry.assets?.find((asset) => asset.logo) ?? (entry.asset?.logo ? entry.asset : null);

  if (logoAsset?.logo) {
    const symbol = logoAsset.symbol;

    return (
      <AssetAvatar
        logo={logoAsset.logo}
        name={logoAsset.name ?? logoAsset.symbol ?? logoAsset.mint}
        {...(symbol ? { symbol } : {})}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        entry.failed ? "bg-destructive/15 text-destructive" : "bg-secondary/60 text-foreground",
      )}
      aria-hidden="true"
    >
      {entry.failed ? (
        <XCircle className="h-4 w-4" />
      ) : (
        <ReceiptText className="h-4 w-4" />
      )}
    </span>
  );
}

export function HistoryCard({
  cluster,
  gatewayOrigin,
  walletAddress,
}: {
  cluster: SolanaCluster;
  gatewayOrigin: string | undefined;
  walletAddress: string | undefined;
}) {
  // Cursor stack: each entry is the `before` signature for its page; the first
  // page has no cursor. Pushing/popping drives Next/Prev pagination.
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const before = cursors[cursors.length - 1];
  const pageIndex = cursors.length;

  const enabled = Boolean(gatewayOrigin && walletAddress);
  const query = useQuery({
    queryKey: ["wallet-transactions", gatewayOrigin, walletAddress, cluster, before ?? "first"],
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async () => {
      if (!gatewayOrigin || !walletAddress) {
        throw new Error("Wallet transactions are unavailable.");
      }

      const envelope = await readGatewayWalletTransactions(gatewayOrigin, {
        walletAddress,
        network: cluster,
        limit: pageSize,
        ...(before ? { before } : {}),
      });

      if (!envelope.ok) {
        throw new Error(envelope.error.message);
      }

      return envelope.data;
    },
  });

  const signatures = query.data?.signatures ?? [];
  const canPrev = pageIndex > 1;
  const canNext = signatures.length === pageSize;

  const goNext = () => {
    const last = signatures[signatures.length - 1];
    if (last) setCursors((prev) => [...prev, last.signature]);
  };
  const goPrev = () => {
    setCursors((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  return (
    <section className="rounded-[28px] border border-border/60 bg-card/80 text-card-foreground shadow-[0_28px_80px_rgba(0,0,0,0.32)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Clock3 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Activity
        </h2>
        <span className="text-xs text-muted-foreground">Page {pageIndex}</span>
      </div>

      <div className="min-h-[17.5rem]">
        <HistoryBody
          enabled={enabled}
          isLoading={query.isLoading}
          isError={query.isError}
          isFetching={query.isFetching}
          error={query.error}
          signatures={signatures}
          walletAddress={walletAddress}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/60 p-4">
        <p className="text-xs text-muted-foreground">
          Showing {signatures.length} on-chain transaction{signatures.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={!canPrev || query.isFetching}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={!canNext || query.isFetching}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function HistoryBody({
  enabled,
  error,
  isError,
  isFetching,
  isLoading,
  signatures,
  walletAddress,
}: {
  enabled: boolean;
  error: unknown;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  signatures: WalletTransactionSignature[];
  walletAddress: string | undefined;
}) {
  const [copyState, setCopyState] = useState<{
    signature: string;
    status: CopyStatus;
  } | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const setTemporaryCopyState = (signature: string, status: CopyStatus) => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    setCopyState({ signature, status });
    resetTimerRef.current = setTimeout(() => setCopyState(null), 1200);
  };

  const copySignature = async (signature: string) => {
    try {
      await navigator.clipboard.writeText(signature);
      setTemporaryCopyState(signature, "copied");
    } catch {
      setTemporaryCopyState(signature, "failed");
    }
  };

  if (!walletAddress || !enabled) {
    return (
      <p className="p-5 text-sm text-muted-foreground">
        Connect a wallet to view your on-chain transaction history.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: pageSize }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 p-4">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-secondary" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-40 animate-pulse rounded bg-secondary" />
              <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
        <TriangleAlert className="h-4 w-4 text-warning" aria-hidden="true" />
        {error instanceof Error ? error.message : "Unable to load transaction history."}
      </p>
    );
  }

  if (signatures.length === 0) {
    return (
      <p className="p-5 text-sm text-muted-foreground">
        No on-chain transactions found for this wallet yet.
      </p>
    );
  }

  return (
    <ul className={cn("divide-y divide-border", isFetching && "opacity-60")}>
      {signatures.map((entry) => {
        const explorerUrl = entry.explorerUrl;
        const copyStatus = copyState?.signature === entry.signature ? copyState.status : null;
        const CopyIcon = copyStatus === "copied" ? Check : Copy;
        const amountLabel = formatTransactionAmount(entry);

        return (
          <li key={entry.signature} className="flex items-center gap-3 p-4">
            <HistoryEntryIcon entry={entry} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate font-mono text-sm font-semibold">
                  {shortenSignature(entry.signature)}
                </p>
                <button
                  type="button"
                  onClick={() => void copySignature(entry.signature)}
                  className={cn(
                    "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground",
                    "transition-colors duration-150 hover:text-foreground focus-visible:outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    copyStatus === "copied" && "text-success",
                    copyStatus === "failed" && "text-destructive",
                  )}
                  aria-label="Copy transaction hash"
                >
                  <CopyIcon
                    className={cn(
                      "h-4 w-4",
                      copyStatus === "copied" && "motion-safe:animate-bounce",
                    )}
                    aria-hidden="true"
                  />
                </button>
                {explorerUrl ? (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground",
                      "transition-colors duration-150 hover:text-foreground focus-visible:outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                    aria-label="View transaction on explorer"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {entry.summary?.label ?? (entry.failed ? "Failed" : "Success")}
                {entry.memo ? ` · ${entry.memo}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "max-w-[13rem] truncate text-xs font-semibold tabular-nums",
                  amountToneClass(entry),
                )}
                title={amountLabel}
              >
                {amountLabel}
              </p>
              <p className="text-xs font-medium tabular-nums text-muted-foreground">
                {formatRelativeTime(entry.blockTime)}
              </p>
              {entry.confirmationStatus ? (
                <p className="flex items-center justify-end gap-1 text-[0.6875rem] capitalize text-muted-foreground/80">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  {entry.confirmationStatus}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
      {copyState ? (
        <p className="sr-only" role="status">
          {copyState.status === "copied"
            ? "Transaction hash copied"
            : "Transaction hash copy failed"}
        </p>
      ) : null}
    </ul>
  );
}
