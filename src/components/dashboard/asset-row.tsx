import { ArrowUpRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AssetAvatar } from "@/components/dashboard/asset-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AssetRow({
  amount,
  name,
  native = false,
  subLabel,
  symbol,
}: {
  amount: string;
  name: string;
  native?: boolean;
  subLabel?: string;
  symbol: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 p-4 sm:grid-cols-[1.5fr_1fr_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <AssetAvatar symbol={symbol} native={native} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{subLabel ?? symbol}</p>
        </div>
      </div>
      <div className="text-right sm:text-left">
        <p className="text-sm font-semibold tabular-nums">
          {amount} <span className="text-muted-foreground">{symbol}</span>
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
