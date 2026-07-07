"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  HistoryEntryIcon,
  HistoryStatusBadge,
  HistoryTableHeader,
  historyRowGridClass,
} from "@/components/dashboard/history-parts";
import {
  amountToneClass,
  formatRelativeTime,
  formatTransactionAmount,
  shortenSignature,
} from "@/components/dashboard/history-format";
import { TransactionDetailsDialog } from "@/components/dashboard/transaction-details-dialog";
import { Button } from "@/components/ui/button";
import { readGatewayWalletTransactions } from "@/lib/offpay/gateway-client";
import type { SolanaCluster, WalletTransactionSignature } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

const pageSize = 5;
type CopyStatus = "copied" | "failed";
type SelectHandler = (entry: WalletTransactionSignature, element: HTMLElement) => void;

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
  const [detail, setDetail] = useState<{
    entry: WalletTransactionSignature;
    originRect: DOMRect;
  } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
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

      if (!envelope.ok) throw new Error(envelope.error.message);
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

  const handleSelect = useCallback<SelectHandler>((entry, element) => {
    setDetail({ entry, originRect: element.getBoundingClientRect() });
    setDetailOpen(true);
  }, []);

  return (
    <section className="offpay-dashboard-card text-card-foreground">
      <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-6">
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
          onSelect={handleSelect}
          signatures={signatures}
          walletAddress={walletAddress}
        />
      </div>

      <div className="flex items-center justify-end gap-3 px-5 pb-5 pt-2">
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

      <TransactionDetailsDialog
        cluster={cluster}
        entry={detail?.entry ?? null}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        originRect={detail?.originRect ?? null}
      />
    </section>
  );
}

function HistoryBody({
  enabled,
  error,
  isError,
  isFetching,
  isLoading,
  onSelect,
  signatures,
  walletAddress,
}: {
  enabled: boolean;
  error: unknown;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  onSelect: SelectHandler;
  signatures: WalletTransactionSignature[];
  walletAddress: string | undefined;
}) {
  const [copyState, setCopyState] = useState<{ signature: string; status: CopyStatus } | null>(
    null,
  );
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const copySignature = async (signature: string) => {
    const status: CopyStatus = await navigator.clipboard
      .writeText(signature)
      .then((): CopyStatus => "copied")
      .catch((): CopyStatus => "failed");

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setCopyState({ signature, status });
    resetTimerRef.current = setTimeout(() => setCopyState(null), 1200);
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
      <div className="space-y-1.5 px-2 pb-2">
        {Array.from({ length: pageSize }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-[2rem] p-4">
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
    <div>
      <HistoryTableHeader />
      <ul className={cn("space-y-1.5 px-2 pb-2", isFetching && "opacity-60")}>
        {signatures.map((entry) => (
          <HistoryRow
            key={entry.signature}
            entry={entry}
            copyStatus={copyState?.signature === entry.signature ? copyState.status : null}
            onCopy={copySignature}
            onSelect={onSelect}
          />
        ))}
      </ul>
      {copyState ? (
        <p className="sr-only" role="status">
          {copyState.status === "copied"
            ? "Transaction hash copied"
            : "Transaction hash copy failed"}
        </p>
      ) : null}
    </div>
  );
}

function HistoryRow({
  copyStatus,
  entry,
  onCopy,
  onSelect,
}: {
  copyStatus: CopyStatus | null;
  entry: WalletTransactionSignature;
  onCopy: (signature: string) => void;
  onSelect: SelectHandler;
}) {
  const CopyIcon = copyStatus === "copied" ? Check : Copy;
  const amountLabel = formatTransactionAmount(entry);

  const open = (element: HTMLElement) => onSelect(entry, element);

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={(event) => open(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(event.currentTarget);
        }
      }}
      className={cn(
        historyRowGridClass,
        "cursor-pointer rounded-[2rem] px-4 py-3.5 transition-colors hover:bg-secondary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      )}
      aria-label="View transaction details"
    >
      <div className="flex min-w-0 items-center gap-3">
        <HistoryEntryIcon entry={entry} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            <p className="truncate font-mono text-sm font-semibold">
              {shortenSignature(entry.signature)}
            </p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onCopy(entry.signature);
              }}
              className={cn(
                "flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground",
                "transition-colors duration-150 hover:text-foreground focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                copyStatus === "copied" && "text-success",
                copyStatus === "failed" && "text-destructive",
              )}
              aria-label="Copy transaction hash"
            >
              <CopyIcon className="h-4 w-4" aria-hidden="true" />
            </button>
            {entry.explorerUrl ? (
              <a
                href={entry.explorerUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className={cn(
                  "flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground",
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
      </div>

      <div className="min-w-0 text-right sm:text-left">
        <p
          className={cn("truncate text-sm font-semibold tabular-nums", amountToneClass(entry))}
          title={amountLabel}
        >
          {amountLabel}
        </p>
      </div>

      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-xs font-medium tabular-nums text-muted-foreground">
          {formatRelativeTime(entry.blockTime)}
        </p>
      </div>

      <div className="hidden sm:flex sm:justify-center">
        <HistoryStatusBadge entry={entry} />
      </div>
    </li>
  );
}
