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
  amountToneClass,
  formatTransactionAmount,
  shortenSignature,
} from "@/components/dashboard/history-format";
import { MorphDialog } from "@/components/ui/morph-dialog";
import type {
  SolanaCluster,
  WalletTransactionAsset,
  WalletTransactionSignature,
} from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

const clusterLabels: Record<SolanaCluster, string> = {
  "solana:devnet": "Solana devnet",
  "solana:testnet": "Solana testnet",
  "solana:mainnet": "Solana mainnet",
};

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

function assetLabel(asset: WalletTransactionAsset | undefined): string | null {
  if (!asset) return null;
  return asset.symbol && asset.symbol !== asset.mint ? asset.symbol : null;
}

// Contextual From/To, resolved by transaction kind. Sent/received use the
// on-chain counterparty; shield/unshield/claims map to the wallet's public and
// private balances; swaps show the sold and bought assets.
function transactionFlow(
  entry: WalletTransactionSignature,
): { from: string; to: string } | null {
  const other = entry.counterparty ? shortenSignature(entry.counterparty) : null;

  switch (entry.summary?.kind) {
    case "received":
      return { from: other ?? "External wallet", to: "Your wallet" };
    case "sent":
      return { from: "Your wallet", to: other ?? "External wallet" };
    case "shielded":
      return { from: "Public balance", to: "Private balance" };
    case "unshielded":
      return { from: "Private balance", to: "Public balance" };
    case "swapped": {
      const sold = entry.assets?.find((item) => (item.uiAmountChange ?? 0) < 0);
      const bought = entry.assets?.find((item) => (item.uiAmountChange ?? 0) > 0);
      return {
        from: assetLabel(sold) ?? "Your wallet",
        to: assetLabel(bought) ?? "Your wallet",
      };
    }
    default:
      return other ? { from: other, to: "Your wallet" } : null;
  }
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
      className="max-w-lg rounded-t-3xl border border-border/70 bg-card text-card-foreground shadow-[0_40px_120px_rgba(0,0,0,0.55)] sm:rounded-[28px]"
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
  const flow = transactionFlow(entry);
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
    <div>
      <div className="relative p-6 pb-5">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close transaction details"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <TokenIcon logoURI={asset?.logo ?? null} symbol={symbol ?? "TX"} size={56} />
        <h2 className={cn("mt-4 text-2xl font-semibold tracking-tight", amountToneClass(entry))}>
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {entry.failed
            ? "This transaction failed on-chain."
            : "Settled on-chain and confirmed by the network."}
        </p>
      </div>

      <dl className="border-t border-border/60 px-6">
        <DetailRow label="Amount">
          <span className="inline-flex items-center gap-1.5">
            {asset ? <TokenIcon logoURI={asset.logo ?? null} symbol={symbol ?? "TX"} size={18} /> : null}
            <span className={cn("font-semibold tabular-nums", amountToneClass(entry))}>
              {amountLabel}
            </span>
          </span>
        </DetailRow>
        <DetailRow label="Type">
          {entry.summary?.label ?? (entry.failed ? "Failed" : "Success")}
        </DetailRow>
        {flow ? (
          <>
            <DetailRow label="From">{flow.from}</DetailRow>
            <DetailRow label="To">{flow.to}</DetailRow>
          </>
        ) : null}
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
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </DetailRow>
        ) : null}
      </dl>
      <div className="h-4" />
    </div>
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
        "flex items-center justify-between gap-4 py-4",
        !last && "border-b border-border/50",
      )}
    >
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

function StatusPill({ entry }: { entry: WalletTransactionSignature }) {
  const rawStatus = entry.failed ? "Failed" : entry.confirmationStatus ?? "Pending";
  const normalized = rawStatus.toLowerCase();
  const isConfirmed = normalized === "finalized" || normalized === "confirmed";
  const Icon = entry.failed ? XCircle : isConfirmed ? CheckCircle2 : Clock3;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.6875rem] font-medium capitalize ring-1 ring-inset",
        entry.failed
          ? "bg-loss/15 text-loss ring-loss/25"
          : isConfirmed
            ? "bg-gain/15 text-gain ring-gain/25"
            : "bg-warning/15 text-warning ring-warning/25",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {rawStatus}
    </span>
  );
}
