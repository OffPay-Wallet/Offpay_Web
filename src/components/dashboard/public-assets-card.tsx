import { Coins, RefreshCw, TriangleAlert } from "lucide-react";

import { AssetRow, assetRowGridClass } from "@/components/dashboard/asset-row";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/offpay/display";
import {
  nativeSolMint,
  type PortfolioValueChange,
} from "@/lib/offpay/portfolio-valuation";
import { nativeSolMeta, resolveTokenMeta } from "@/lib/offpay/tokens";
import type { SolanaCluster, WalletPortfolio, WalletTokenBalance } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

const emptyUnitUsdPrices: Readonly<Record<string, number>> = Object.freeze({});
const emptyValueChanges: Readonly<Record<string, PortfolioValueChange>> = Object.freeze({});

export function PublicAssetsCard({
  cluster,
  error,
  gatewayConfigured,
  holdingValueChanges = emptyValueChanges,
  isError,
  isFetching,
  isLoading,
  onRetry,
  pnlTimeframeLabel,
  portfolio,
  unitUsdPrices = emptyUnitUsdPrices,
  walletAddress,
}: {
  cluster: SolanaCluster;
  error: unknown;
  gatewayConfigured: boolean;
  holdingValueChanges?: Readonly<Record<string, PortfolioValueChange>>;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  onRetry: () => void;
  pnlTimeframeLabel?: string | undefined;
  portfolio: WalletPortfolio | undefined;
  unitUsdPrices?: Readonly<Record<string, number>>;
  walletAddress: string | undefined;
}) {
  return (
    <section className="offpay-dashboard-card h-full text-card-foreground">
      <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-6">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Coins className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Public assets
        </h2>
      </div>
      <PublicAssetsContent
        cluster={cluster}
        error={error}
        gatewayConfigured={gatewayConfigured}
        holdingValueChanges={holdingValueChanges}
        isError={isError}
        isFetching={isFetching}
        isLoading={isLoading}
        onRetry={onRetry}
        pnlTimeframeLabel={pnlTimeframeLabel}
        portfolio={portfolio}
        unitUsdPrices={unitUsdPrices}
        walletAddress={walletAddress}
      />
    </section>
  );
}

function AssetTableHeader({
  pnlTimeframeLabel,
}: {
  pnlTimeframeLabel?: string | undefined;
}) {
  return (
    <div
      className={cn(
        assetRowGridClass,
        "hidden px-6 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 sm:grid",
      )}
    >
      <span>Asset</span>
      <span>Price</span>
      <span>Balance</span>
      <span>Value</span>
      <span>{pnlTimeframeLabel ? `${pnlTimeframeLabel} PNL` : "PNL"}</span>
      <span className="text-center">Actions</span>
    </div>
  );
}

function PublicAssetsContent({
  cluster,
  error,
  gatewayConfigured,
  holdingValueChanges,
  isError,
  isFetching,
  isLoading,
  onRetry,
  pnlTimeframeLabel,
  portfolio,
  unitUsdPrices,
  walletAddress,
}: {
  cluster: SolanaCluster;
  error: unknown;
  gatewayConfigured: boolean;
  holdingValueChanges: Readonly<Record<string, PortfolioValueChange>>;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  onRetry: () => void;
  pnlTimeframeLabel?: string | undefined;
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
      <div className="space-y-1.5 px-2 pb-2">
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center gap-3 rounded-[2rem] p-4">
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
      <AssetTableHeader pnlTimeframeLabel={pnlTimeframeLabel} />
      <div className="space-y-1.5 px-2 pb-2">
        <AssetRow
          change={holdingValueChanges[nativeSolMint] ?? null}
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
              change={holdingValueChanges[token.mint] ?? null}
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
