import { LockKeyhole } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function ShieldedAssetsCard() {
  return (
    <section className="rounded-lg border border-border bg-card text-card-foreground">
      <div className="flex items-center justify-between gap-3 border-b border-border p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Shielded assets
        </h2>
        <Badge tone="neutral">Coming soon</Badge>
      </div>
      <p className="p-5 text-sm leading-6 text-muted-foreground">
        Private balances will appear here once Umbra shielded pools are enabled for Offpay Web.
        Shielded reads and claims stay protected in the connected wallet session.
      </p>
    </section>
  );
}
