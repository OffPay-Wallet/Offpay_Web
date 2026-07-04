import { LockKeyhole, RefreshCw } from "lucide-react";

import { WalletActionLinks } from "@/components/dashboard/wallet-action-links";
import { Badge } from "@/components/ui/badge";
import { formatTokenAmount } from "@/lib/offpay/tokens";
import { cn } from "@/lib/utils";

export function WalletBalanceSummary({
  isFetching,
  onRefresh,
  publicAssetCount,
  solUiAmount,
  tokenCount,
  walletAddress,
}: {
  isFetching: boolean;
  onRefresh: () => void;
  publicAssetCount: number;
  solUiAmount: number;
  tokenCount: number;
  walletAddress: string | undefined;
}) {
  const hasPortfolio = publicAssetCount > 0;

  return (
    <section className="rounded-lg border border-border bg-card p-5 text-card-foreground md:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Total balance
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={!walletAddress || isFetching}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground",
            "transition-colors hover:bg-secondary focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
          title="Refresh balances"
          aria-label="Refresh balances"
        >
          <RefreshCw
            className={cn("h-4 w-4", isFetching && "motion-safe:animate-spin")}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-bold tabular-nums md:text-5xl">
          {hasPortfolio ? formatTokenAmount(solUiAmount) : "--"}
        </span>
        <span className="text-lg font-semibold text-muted-foreground">SOL</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasPortfolio
          ? `Native SOL - ${publicAssetCount} public asset${publicAssetCount === 1 ? "" : "s"}`
          : "Connecting wallet and loading balances"}
      </p>

      <div className="mt-5">
        <WalletActionLinks />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Un-shielded (public)
            </span>
            <Badge tone="success">Live</Badge>
          </div>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {hasPortfolio ? `${formatTokenAmount(solUiAmount)} SOL` : "--"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasPortfolio
              ? `${tokenCount} token${tokenCount === 1 ? "" : "s"} held`
              : "Public on-chain balances"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Shielded (private)
            </span>
            <Badge tone="success">Encrypted</Badge>
          </div>
          <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-muted-foreground">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            Encrypted holdings
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Synced through the Umbra vault
          </p>
        </div>
      </div>

      {!walletAddress ? (
        <div className="mt-5 rounded-lg border border-border bg-background p-4">
          <p className="text-sm text-muted-foreground">
            Preparing your Privy Solana wallet for this account.
          </p>
        </div>
      ) : null}
    </section>
  );
}
