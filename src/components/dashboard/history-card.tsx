"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ReceiptText,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { readGatewayWalletTransactions } from "@/lib/offpay/gateway-client";
import type { SolanaCluster, WalletTransactionSignature } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

const pageSize = 5;

function shortenSignature(signature: string): string {
  if (signature.length <= 16) return signature;
  return `${signature.slice(0, 6)}…${signature.slice(-6)}`;
}

function formatRelativeTime(blockTimeSeconds: number | null): string {
  if (!blockTimeSeconds) return "Pending";

  const deltaSeconds = Math.max(0, Math.floor(Date.now() / 1000 - blockTimeSeconds));
  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;

  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(blockTimeSeconds * 1000).toLocaleDateString();
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
      {signatures.map((entry) => (
        <li key={entry.signature} className="flex items-center gap-3 p-4">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
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
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm font-semibold">
              {shortenSignature(entry.signature)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {entry.failed ? "Failed" : "Success"}
              {entry.memo ? ` · ${entry.memo}` : ""}
            </p>
          </div>
          <div className="shrink-0 text-right">
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
      ))}
    </ul>
  );
}
