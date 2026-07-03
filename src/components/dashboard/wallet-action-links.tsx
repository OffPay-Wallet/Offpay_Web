import { ArrowRightLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WalletActionLinks() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/send" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        Send
      </Link>
      <Link href="/swap" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
        <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
        Swap
      </Link>
      <Button variant="ghost" size="sm" disabled title="Shielding is not enabled yet">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        Shield
      </Button>
    </div>
  );
}
