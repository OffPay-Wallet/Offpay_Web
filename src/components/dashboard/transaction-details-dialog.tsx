"use client";

import {
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { TokenIcon } from "@/components/dashboard/token-picker";
import {
  formatTransactionAmount,
  shortenSignature,
} from "@/components/dashboard/history-format";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { MorphDialog } from "@/components/ui/morph-dialog";
import type {
  SolanaCluster,
  WalletTransactionSignature,
} from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

const clusterLabels: Record<SolanaCluster, string> = {
  "solana:devnet": "Solana devnet",
  "solana:testnet": "Solana testnet",
  "solana:mainnet": "Solana mainnet",
};

// Resolves the card's status tone: success (green), failure (red) or the
// pending/neutral state (silver).
function statusTone(
  entry: WalletTransactionSignature,
): { tint: string; confirmed: boolean } {
  if (entry.failed) return { tint: "var(--offpay-color-red)", confirmed: false };

  const normalized = entry.confirmationStatus?.toLowerCase();
  const confirmed = normalized === "finalized" || normalized === "confirmed";
  return {
    tint: confirmed ? "var(--offpay-color-green)" : "var(--offpay-color-silver)",
    confirmed,
  };
}

function primaryAsset(entry: WalletTransactionSignature) {
  return entry.assets?.find((asset) => asset.logo) ?? entry.assets?.[0] ?? entry.asset ?? null;
}

function formatFullDate(blockTime: number | null): string {
  if (!blockTime) return "Pending";
  return new Date(blockTime * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TransactionDetailsDialog({
  cluster,
  entry,
  onClose,
  open,
  originRect,
}: {
  cluster: SolanaCluster;
  entry: WalletTransactionSignature | null;
  onClose: () => void;
  open: boolean;
  originRect: DOMRect | null;
}) {
  return (
    <MorphDialog
      open={open}
      onClose={onClose}
      originRect={originRect}
      ariaLabel="Transaction details"
      className="max-w-lg text-card-foreground"
    >
      {entry ? <DetailsBody cluster={cluster} entry={entry} onClose={onClose} /> : null}
    </MorphDialog>
  );
}

function DetailsBody({
  cluster,
  entry,
  onClose,
}: {
  cluster: SolanaCluster;
  entry: WalletTransactionSignature;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const asset = primaryAsset(entry);
  const symbol = asset?.symbol && asset.symbol !== asset.mint ? asset.symbol : undefined;
  const title = `${entry.summary?.label ?? (entry.failed ? "Failed transaction" : "Transaction")}${
    symbol ? ` ${symbol}` : ""
  }`;
  const amountLabel = formatTransactionAmount(entry);
  const tone = statusTone(entry);
  const CopyIcon = copied ? Check : Copy;

  const copySignature = async () => {
    try {
      await navigator.clipboard.writeText(entry.signature);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard can be unavailable; silently ignore.
    }
  };

  return (
    <LiquidGlass
      tint={tone.tint}
      className="rounded-t-3xl [text-shadow:0_1px_2px_rgb(0_0_0/0.45)] sm:rounded-[28px]"
    >
      <div className="relative p-6 pb-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-foreground/80 transition-colors hover:bg-black/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close transaction details"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <TokenIcon logoURI={asset?.logo ?? null} symbol={symbol ?? "TX"} size={48} />
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm text-foreground/85">
          {entry.failed
            ? "This transaction failed on-chain."
            : "Settled on-chain and confirmed by the network."}
        </p>
      </div>

      <dl className="border-t border-white/10 px-6">
        <DetailRow label="Amount">
          <span className="inline-flex items-center gap-1.5">
            {asset ? <TokenIcon logoURI={asset.logo ?? null} symbol={symbol ?? "TX"} size={18} /> : null}
            <span className="font-semibold tabular-nums text-foreground">
              {amountLabel}
            </span>
          </span>
        </DetailRow>
        <DetailRow label="Type">
          {entry.summary?.label ?? (entry.failed ? "Failed" : "Success")}
        </DetailRow>
        <DetailRow label="Status">
          <StatusPill entry={entry} />
        </DetailRow>
        <DetailRow label="Network">{clusterLabels[cluster]}</DetailRow>
        <DetailRow label="Slot">
          {entry.slot != null ? entry.slot.toLocaleString() : "--"}
        </DetailRow>
        <DetailRow label="Date">{formatFullDate(entry.blockTime)}</DetailRow>
        {entry.memo ? <DetailRow label="Memo">{entry.memo}</DetailRow> : null}
        <DetailRow label="Signature">
          <button
            type="button"
            onClick={() => void copySignature()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-mono text-sm text-foreground",
              "transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              copied && "text-success",
            )}
            aria-label="Copy transaction signature"
          >
            {shortenSignature(entry.signature)}
            <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </DetailRow>
        {entry.explorerUrl ? (
          <DetailRow label="Explorer" last>
            <a
              href={entry.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </DetailRow>
        ) : null}
      </dl>
      <div className="h-2" />
    </LiquidGlass>
  );
}

function DetailRow({
  children,
  label,
  last,
}: {
  children: ReactNode;
  label: string;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3",
        !last && "border-b border-white/10",
      )}
    >
      <dt className="text-sm font-medium text-foreground/80">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-semibold text-foreground">
        {children}
      </dd>
    </div>
  );
}

function StatusPill({ entry }: { entry: WalletTransactionSignature }) {
  const rawStatus = entry.failed ? "Failed" : entry.confirmationStatus ?? "Pending";
  const normalized = rawStatus.toLowerCase();
  const isConfirmed = normalized === "finalized" || normalized === "confirmed";
  const Icon = entry.failed ? XCircle : isConfirmed ? CheckCircle2 : Clock3;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-1 text-[0.6875rem] font-medium capitalize text-foreground ring-1 ring-inset ring-white/15">
      <Icon
        className={cn(
          "h-3 w-3",
          entry.failed ? "text-loss" : isConfirmed ? "text-gain" : "text-warning",
        )}
        aria-hidden="true"
      />
      {rawStatus}
    </span>
  );
}
