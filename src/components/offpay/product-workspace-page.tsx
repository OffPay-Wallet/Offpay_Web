import type { ReactNode } from "react";

import { PageHeader } from "@/components/offpay/page-header";
import { SectionCard } from "@/components/offpay/section-card";
import { Badge } from "@/components/ui/badge";

type Stat = {
  label: string;
  value: string;
  helper: string;
};

type Lane = {
  title: string;
  description: string;
  state: "Ready" | "Design" | "Queued";
};

type ProductWorkspacePageProps = {
  description: string;
  eyebrow: string;
  icon: ReactNode;
  lanes: readonly Lane[];
  stats: readonly Stat[];
  title: string;
};

const stateTone = {
  Design: "neutral",
  Queued: "warning",
  Ready: "success",
} as const;

export function ProductWorkspacePage({
  description,
  eyebrow,
  icon,
  lanes,
  stats,
  title,
}: ProductWorkspacePageProps) {
  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        icon={
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary/60 text-foreground">
            {icon}
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard title="Desk">
          <div className="grid gap-3 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-3 font-display text-2xl font-bold tabular-nums">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{stat.helper}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="State">
          <div className="space-y-3">
            {lanes.map((lane) => (
              <div key={lane.title} className="rounded-lg bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{lane.title}</p>
                  <Badge tone={stateTone[lane.state]}>{lane.state}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {lane.description}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
