import { LockKeyhole } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function ShieldedAssetsCard() {
  return (
    <section className="h-full rounded-[28px] border border-border/60 bg-card/80 text-card-foreground shadow-[0_28px_80px_rgba(0,0,0,0.32)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Shielded assets
        </h2>
        <Badge tone="neutral">Coming soon</Badge>
      </div>
    </section>
  );
}
