import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

export function SwapModeCard({
  children,
  description,
  label,
  tone = "neutral",
}: {
  children: ReactNode;
  description: string;
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 text-card-foreground">
      <div className="mb-4 flex flex-col gap-2">
        <Badge tone={tone}>{label}</Badge>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
