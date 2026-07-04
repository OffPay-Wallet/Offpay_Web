import { CheckCircle2, Clock3, ReceiptText, XCircle } from "lucide-react";

import { AssetAvatar } from "@/components/dashboard/asset-avatar";
import type { WalletTransactionSignature } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

// Shared column template so the header and every row align their columns.
export const historyRowGridClass =
  "grid grid-cols-[1fr_auto] items-center gap-3 sm:grid-cols-[minmax(0,1.7fr)_1fr_1fr_9rem]";

export function HistoryTableHeader() {
  return (
    <div
      className={cn(
        historyRowGridClass,
        "hidden border-b border-border/60 px-4 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 sm:grid",
      )}
    >
      <span>Transaction</span>
      <span>Amount</span>
      <span>Date</span>
      <span className="text-center">Status</span>
    </div>
  );
}

export function HistoryStatusBadge({ entry }: { entry: WalletTransactionSignature }) {
  const rawStatus = entry.failed ? "Failed" : entry.confirmationStatus ?? "Pending";
  const normalized = rawStatus.toLowerCase();
  const isConfirmed = normalized === "finalized" || normalized === "confirmed";
  const isPending = !entry.failed && !isConfirmed;
  const Icon = entry.failed ? XCircle : isConfirmed ? CheckCircle2 : Clock3;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.6875rem] font-medium capitalize ring-1 ring-inset",
        entry.failed && "bg-loss/15 text-loss ring-loss/25",
        isConfirmed && "bg-gain/15 text-gain ring-gain/25",
        isPending && "bg-warning/15 text-warning ring-warning/25",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {rawStatus}
    </span>
  );
}

export function HistoryEntryIcon({ entry }: { entry: WalletTransactionSignature }) {
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
      {entry.failed ? <XCircle className="h-4 w-4" /> : <ReceiptText className="h-4 w-4" />}
    </span>
  );
}
