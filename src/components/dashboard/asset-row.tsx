import { ArrowUpRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AssetAvatar } from "@/components/dashboard/asset-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatFiatValue, formatTokenAmountDisplay } from "@/lib/offpay/number-format";
import { cn } from "@/lib/utils";

// Shared grid template so the header and every row align their columns.
export const assetRowGridClass =
  "grid grid-cols-2 items-center gap-3 sm:grid-cols-[1.6fr_1fr_1fr_13rem]";

export function AssetRow({
  logo,
  name,
  priceUsd,
  symbol,
  uiAmount,
}: {
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

  return (
    <div className={cn(assetRowGridClass, "p-4")}>
      <div className="flex min-w-0 items-center gap-3">
        <AssetAvatar logo={logo} name={name} symbol={symbol} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{symbol}</p>
        </div>
      </div>

      <div className="min-w-0 text-right sm:text-left">
        <p className="truncate text-sm font-semibold tabular-nums">
          {amountLabel} <span className="text-muted-foreground">{symbol}</span>
        </p>
        <p className="truncate text-xs tabular-nums text-muted-foreground">{fiatLabel}</p>
      </div>

      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-sm font-semibold tabular-nums">{fiatLabel}</p>
        <p className="truncate text-xs tabular-nums text-muted-foreground">
          {amountLabel} {symbol}
        </p>
      </div>

      <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
        <Link href="/send" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          Send
        </Link>
        <Button variant="ghost" size="sm" disabled title="Shielding is not enabled yet">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Shield
        </Button>
      </div>
    </div>
  );
}
