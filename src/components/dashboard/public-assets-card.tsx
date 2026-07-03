import { Coins, RefreshCw, TriangleAlert } from "lucide-react";

import { AssetRow, assetRowGridClass } from "@/components/dashboard/asset-row";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/offpay/display";
import { nativeSolMint } from "@/lib/offpay/portfolio-valuation";
import { nativeSolMeta, resolveTokenMeta } from "@/lib/offpay/tokens";
import type { SolanaCluster, WalletPortfolio, WalletTokenBalance } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

const emptyUnitUsdPrices: Readonly<Record<string, number>> = Object.freeze({});

export function PublicAssetsCard({
  cluster,
  error,
  gatewayConfigured,
  isError,
  isFetching,
  isLoading,
  onRetry,
  portfolio,
  unitUsdPrices = emptyUnitUsdPrices,
  walletAddress,
}: {
  cluster: SolanaCluster;
  error: unknown;
  gatewayConfigured: boolean;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  onRetry: () => void;
  portfolio: WalletPortfolio | undefined;
  unitUsdPrices?: Readonly<Record<string, number>>;
  walletAddress: string | undefined;
}) {
  return (
    <section className="h-full overflow-hidden rounded-[28px] border border-border/60 bg-card/80 text-card-foreground shadow-[0_28px_80px_rgba(0,0,0,0.32)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Coins className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Public assets
        </h2>
      </div>
      <PublicAssetsContent
        cluster={cluster}
        error={error}
        gatewayConfigured={gatewayConfigured}
        isError={isError}
        isFetching={isFetching}
        isLoading={isLoading}
        onRetry={onRetry}
        portfolio={portfolio}
        unitUsdPrices={unitUsdPrices}
        walletAddress={walletAddress}
      />
    </section>
  );
}

function AssetTableHeader() {
  return (
    <div
      className={cn(
        assetRowGridClass,
        "hidden border-b border-border/60 px-4 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 sm:grid",
      )}
    >
      <span>Asset</span>
      <span>Balance</span>
      <span>Value</span>
      <span aria-hidden="true" />
    </div>
  );
}

function PublicAssetsContent({
  cluster,
  error,
  gatewayConfigured,
  isError,
  isFetching,
  isLoading,
  onRetry,
  portfolio,
  unitUsdPrices,
  walletAddress,
}: {
  cluster: SolanaCluster;
  error: unknown;
  gatewayConfigured: boolean;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  onRetry: () => void;
  portfolio: WalletPortfolio | undefined;
  unitUsdPrices: Readonly<Record<string, number>>;
  walletAddress: string | undefined;
}) {
  if (!walletAddress) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Preparing your Solana wallet for public balances.
      </p>
    );
  }

  if (!gatewayConfigured) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Balance sync is unavailable because the gateway origin is not configured.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="divide-y divide-border">
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center gap-3 p-4">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-secondary" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
              <div className="h-3 w-16 animate-pulse rounded bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <TriangleAlert className="h-4 w-4 text-warning" aria-hidden="true" />
          {getErrorMessage(error)}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={isFetching}
          onClick={onRetry}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Loading public balances for your connected wallet.
      </p>
    );
  }

  return (
    <div>
      <AssetTableHeader />
      <div className="divide-y divide-border">
        <AssetRow
          name={nativeSolMeta.name}
          symbol={nativeSolMeta.symbol}
          logo={portfolio.sol.logo}
          uiAmount={portfolio.sol.uiAmount}
          priceUsd={unitUsdPrices[nativeSolMint] ?? null}
        />
        {portfolio.tokens.map((token: WalletTokenBalance) => {
          const meta = resolveTokenMeta(cluster, token.mint);
          const symbol = token.symbol ?? meta.symbol;
          const uiAmount = token.uiAmount ?? Number(token.uiAmountString);

          return (
            <AssetRow
              key={`${token.programId ?? "api-worker"}:${token.mint}`}
              name={token.name ?? meta.name}
              symbol={symbol}
              logo={token.logo}
              uiAmount={Number.isFinite(uiAmount) ? uiAmount : null}
              priceUsd={unitUsdPrices[token.mint] ?? null}
            />
          );
        })}
        {portfolio.tokens.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            No SPL tokens found for this wallet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
