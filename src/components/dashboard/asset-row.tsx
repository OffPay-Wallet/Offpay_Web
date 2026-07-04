import { ArrowUpRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AssetAvatar } from "@/components/dashboard/asset-avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  formatFiatValue,
  formatPercentValue,
  formatTokenAmountDisplay,
  formatTokenPrice,
} from "@/lib/offpay/number-format";
import type { PortfolioValueChange } from "@/lib/offpay/portfolio-valuation";
import { cn } from "@/lib/utils";

// Shared grid template so the header and every row align their columns.
export const assetRowGridClass =
  "grid grid-cols-2 items-center gap-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_13rem]";

export function AssetRow({
  change,
  logo,
  name,
  priceUsd,
  symbol,
  uiAmount,
}: {
  change?: PortfolioValueChange | null;
  logo?: string | null | undefined;
  name: string;
  priceUsd?: number | null;
  symbol: string;
  uiAmount: number | null;
}) {
  const amountLabel = formatTokenAmountDisplay(uiAmount, priceUsd);
  const usdValue =
    typeof uiAmount === "number" && typeof priceUsd === "number" && priceUsd > 0
      ? uiAmount * priceUsd
      : null;
  const fiatLabel = usdValue == null ? "--" : formatFiatValue(usdValue);
  const priceLabel =
    typeof priceUsd === "number" && priceUsd > 0 ? formatTokenPrice(priceUsd) : "--";

  return (
    <div className={cn(assetRowGridClass, "p-4")}>
      <div className="flex min-w-0 items-center gap-3">
        <AssetAvatar logo={logo} name={name} symbol={symbol} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{symbol}</p>
        </div>
      </div>

      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-sm font-semibold tabular-nums">{priceLabel}</p>
      </div>

      <div className="min-w-0 text-right sm:text-left">
        <p className="truncate text-sm font-semibold tabular-nums">
          {amountLabel} <span className="text-muted-foreground">{symbol}</span>
        </p>
        {/* USD shown here only on mobile, where the Value column is hidden. */}
        <p className="truncate text-xs tabular-nums text-muted-foreground sm:hidden">
          {fiatLabel}
        </p>
      </div>

      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-sm font-semibold tabular-nums">{fiatLabel}</p>
      </div>

      <AssetPnl change={change} />

      <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1 sm:justify-center">
        <Link href="/send" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          Send
        </Link>
        <Link href="/vault" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Shield
        </Link>
      </div>
    </div>
  );
}

function AssetPnl({ change }: { change?: PortfolioValueChange | null | undefined }) {
  if (!change) {
    return (
      <div className="hidden min-w-0 sm:block">
        <p className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
          --
        </p>
        <p className="text-xs text-muted-foreground">No history</p>
      </div>
    );
  }

  const positive = change.tone === "positive";
  const negative = change.tone === "negative";

  return (
    <div
      className={cn(
        "hidden min-w-0 sm:block",
        positive && "text-gain",
        negative && "text-loss",
        !positive && !negative && "text-muted-foreground",
      )}
    >
      <p className="truncate font-mono text-sm font-semibold tabular-nums">
        {formatFiatValue(change.absoluteUsd, { signed: true, compact: true })}
      </p>
      <p className="truncate font-mono text-xs tabular-nums">
        {formatPercentValue(change.percent, true)}
      </p>
    </div>
  );
}
