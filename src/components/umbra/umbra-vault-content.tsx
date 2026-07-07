"use client";

import { AlertCircle, BadgeCheck, LockKeyhole, RefreshCw } from "lucide-react";

import { AssetAvatar } from "@/components/dashboard/asset-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UmbraEncryptedBalance } from "@/lib/offpay/umbra-vault-execution";
import type { UmbraVaultHolding, WalletTokenMetadata } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

import { formatAtomicAmount } from "./umbra-vault-validation";

type VaultContentProps = {
  compact: boolean;
  decryptedBalances?: Map<string, UmbraEncryptedBalance> | undefined;
  decryptedError?: Error | null;
  decryptedLoading?: boolean;
  error: Error | null;
  holdings: UmbraVaultHolding[];
  isError: boolean;
  isLoading: boolean;
  logoByMint: Record<string, WalletTokenMetadata>;
  onRetry: () => void;
  walletReady: boolean;
};

export function VaultContent({
  compact,
  decryptedBalances,
  decryptedError,
  decryptedLoading = false,
  error,
  holdings,
  isError,
  isLoading,
  logoByMint,
  onRetry,
  walletReady,
}: VaultContentProps) {
  if (!walletReady) {
    return <VaultEmptyState title="Connect wallet" compact={compact} />;
  }

  if (isLoading) {
    return <VaultRowsSkeleton compact={compact} />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          Unable to sync encrypted holdings
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {error?.message ?? "Umbra vault data is unavailable."}
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  if (holdings.length === 0) {
    return <VaultEmptyState title="No encrypted holdings" compact={compact} />;
  }

  const maskEncryptedText = compact && decryptedBalances == null;

  return (
    <div
      className={cn(
        compact
          ? "space-y-1.5 rounded-[2rem] bg-background/20 p-1.5"
          : "divide-y divide-border rounded-lg border border-border",
      )}
    >
      {holdings.map((holding) => (
        <HoldingRow
          key={holding.mint}
          balance={decryptedBalances?.get(holding.mint)}
          balanceError={Boolean(decryptedError)}
          balanceLoading={decryptedLoading}
          compact={compact}
          holding={holding}
          maskEncryptedText={maskEncryptedText}
          metadata={logoByMint[holding.mint]}
        />
      ))}
    </div>
  );
}

function VaultEmptyState({ compact, title }: { compact: boolean; title: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4",
        compact
          ? "min-h-24 rounded-[2rem] bg-background/20"
          : "min-h-32 rounded-lg border border-dashed border-border",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <LockKeyhole className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold">{title}</p>
    </div>
  );
}

function VaultRowsSkeleton({ compact }: { compact: boolean }) {
  const rows = compact ? 2 : 3;

  return (
    <div
      className={cn(
        compact
          ? "space-y-1.5 rounded-[2rem] bg-background/20 p-1.5"
          : "divide-y divide-border rounded-lg border border-border",
      )}
      aria-hidden="true"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "flex items-center justify-between gap-3 p-3",
            compact && "rounded-[1.5rem]",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-muted motion-safe:animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-16 rounded bg-muted motion-safe:animate-pulse" />
              <div className="h-3 w-24 rounded bg-muted motion-safe:animate-pulse" />
            </div>
          </div>
          <div className="h-6 w-20 rounded bg-muted motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function HoldingRow({
  balance,
  balanceError,
  balanceLoading,
  compact,
  holding,
  maskEncryptedText,
  metadata,
}: {
  balance: UmbraEncryptedBalance | undefined;
  balanceError: boolean;
  balanceLoading: boolean;
  compact: boolean;
  holding: UmbraVaultHolding;
  maskEncryptedText: boolean;
  metadata: WalletTokenMetadata | undefined;
}) {
  const logo = metadata?.logo ?? null;
  const verified = metadata?.verified === true && !maskEncryptedText;
  const title = maskEncryptedText ? "****" : holding.symbol;
  const subtitle = holding.name || truncateMint(holding.mint);

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] gap-3",
        compact
          ? "items-center rounded-[1.5rem] p-3 transition-colors hover:bg-secondary/20"
          : "items-start p-4",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-mono text-xs font-semibold text-secondary-foreground">
          {holding.symbol.slice(0, 2)}
          <span className="absolute inset-0 flex items-center justify-center">
            <AssetAvatar logo={logo} name={holding.symbol} symbol={holding.symbol} />
          </span>
        </span>
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p
              className={cn(
                "truncate text-sm font-semibold",
                maskEncryptedText && "font-mono tracking-widest",
              )}
              aria-label={maskEncryptedText ? "Encrypted token" : undefined}
            >
              {title}
            </p>
            {verified ? (
              <BadgeCheck
                className="h-3.5 w-3.5 shrink-0 text-success"
                aria-label="Verified token"
              />
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <HoldingBalance
        balance={balance}
        balanceError={balanceError}
        balanceLoading={balanceLoading}
        holding={holding}
        maskEncryptedText={maskEncryptedText}
      />
    </div>
  );
}

function HoldingBalance({
  balance,
  balanceError,
  balanceLoading,
  holding,
  maskEncryptedText,
}: {
  balance: UmbraEncryptedBalance | undefined;
  balanceError: boolean;
  balanceLoading: boolean;
  holding: UmbraVaultHolding;
  maskEncryptedText: boolean;
}) {
  const decrypted = decryptedAmountText(balance, holding);

  if (decrypted != null) {
    return (
      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
        {decrypted}
      </span>
    );
  }

  if (maskEncryptedText) {
    return (
      <span
        className="inline-flex min-h-7 shrink-0 items-center rounded-lg bg-secondary/70 px-3 font-mono text-sm font-semibold tracking-widest text-foreground"
        aria-label="Encrypted balance"
      >
        ****
      </span>
    );
  }

  if (balance?.state === "pending") {
    return (
      <Badge tone="warning" className="shrink-0 border-0">
        Syncing
      </Badge>
    );
  }

  if (balanceLoading) {
    return (
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        Decrypting...
      </span>
    );
  }

  if (balanceError) {
    return (
      <Badge tone="danger" className="shrink-0 border-0">
        Unavailable
      </Badge>
    );
  }

  return (
    <Badge tone="success" className="shrink-0 border-0">
      {holding.balanceLabel}
    </Badge>
  );
}

function decryptedAmountText(
  balance: UmbraEncryptedBalance | undefined,
  holding: UmbraVaultHolding,
): string | null {
  if (!balance || balance.amountAtomic == null || balance.state === "pending") return null;
  if (holding.decimals == null) return null;

  return `${formatAtomicAmount(balance.amountAtomic, holding.decimals)} ${holding.symbol}`;
}

function truncateMint(value: string): string {
  return value.length > 12 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value;
}
