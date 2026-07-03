import { Coins } from "lucide-react";

import { cn } from "@/lib/utils";

export function AssetAvatar({ symbol, native = false }: { symbol: string; native?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase",
        native ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground",
      )}
      aria-hidden="true"
    >
      {native ? <Coins className="h-5 w-5" /> : symbol.slice(0, 3)}
    </span>
  );
}
