import { formatTokenAmountDisplay } from "@/lib/offpay/number-format";
import type { WalletTransactionSignature } from "@/lib/offpay/types";

type TransactionAsset = NonNullable<WalletTransactionSignature["assets"]>[number];

export function shortenSignature(signature: string): string {
  if (signature.length <= 16) return signature;
  return `${signature.slice(0, 6)}…${signature.slice(-6)}`;
}

export function formatRelativeTime(blockTimeSeconds: number | null): string {
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

function normalizedAssetDelta(asset: TransactionAsset) {
  if (typeof asset.uiAmountChange === "number" && Number.isFinite(asset.uiAmountChange)) {
    return Math.abs(asset.uiAmountChange) < Number.EPSILON * 10 ? 0 : asset.uiAmountChange;
  }

  if (asset.rawAmountChange == null || asset.decimals == null) return null;

  const raw = Number(asset.rawAmountChange);
  const divisor = 10 ** asset.decimals;
  const value = raw / divisor;

  if (!Number.isFinite(value)) return null;
  return Math.abs(value) < Number.EPSILON * 10 ? 0 : value;
}

function tokenAmountSymbol(asset: TransactionAsset) {
  const symbol = asset.symbol?.trim();
  return symbol && symbol !== asset.mint ? symbol : "Token";
}

function formatSignedAssetAmount(asset: TransactionAsset): string | null {
  const delta = normalizedAssetDelta(asset);
  if (delta == null || delta === 0) return null;

  const sign = delta > 0 ? "+" : "-";
  return `${sign}${formatTokenAmountDisplay(Math.abs(delta))} ${tokenAmountSymbol(asset)}`;
}

export function formatTransactionAmount(entry: WalletTransactionSignature): string {
  const assets = entry.assets ?? (entry.asset ? [entry.asset] : []);
  const changedAssets = assets.filter((asset) => {
    const delta = normalizedAssetDelta(asset);
    return delta != null && delta !== 0;
  });

  if (entry.summary?.kind === "swapped") {
    const debit = changedAssets.find((asset) => (normalizedAssetDelta(asset) ?? 0) < 0);
    const credit = changedAssets.find((asset) => (normalizedAssetDelta(asset) ?? 0) > 0);
    const debitLabel = debit ? formatSignedAssetAmount(debit) : null;
    const creditLabel = credit ? formatSignedAssetAmount(credit) : null;

    return [debitLabel, creditLabel].filter(Boolean).join(" / ") || "--";
  }

  const preferredAsset =
    entry.summary?.tone === "positive"
      ? changedAssets.find((asset) => (normalizedAssetDelta(asset) ?? 0) > 0)
      : entry.summary?.tone === "negative"
        ? changedAssets.find((asset) => (normalizedAssetDelta(asset) ?? 0) < 0)
        : changedAssets[0];

  return preferredAsset ? (formatSignedAssetAmount(preferredAsset) ?? "--") : "--";
}

export function amountToneClass(entry: WalletTransactionSignature): string {
  if (entry.summary?.tone === "positive") return "text-gain";
  if (entry.summary?.tone === "negative") return "text-loss";
  if (entry.summary?.tone === "failed") return "text-destructive";

  return "text-foreground";
}
