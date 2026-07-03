import { Clock3, Filter, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/offpay/page-header";
import { SectionCard } from "@/components/offpay/section-card";
import { Badge } from "@/components/ui/badge";

const historyRows = [
  {
    title: "Wallet session",
    description: "Signed Solana wallet session boundary",
    state: "Pending",
  },
  {
    title: "Payment drafts",
    description: "Unsigned send and swap reviews",
    state: "Drafts",
  },
  {
    title: "Private claims",
    description: "Shielded receive and claim states",
    state: "Deferred",
  },
] as const;

export default function HistoryPage() {
  return (
    <>
      <PageHeader
        eyebrow="History"
        title="Activity history"
        description="Transactions, private payment state, and draft reviews appear after session sync."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard title="Timeline" icon={<Clock3 className="h-5 w-5" aria-hidden="true" />}>
          <div className="divide-y divide-border rounded-lg border border-border">
            {historyRows.map((row) => (
              <div
                key={row.title}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold">{row.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {row.description}
                  </p>
                </div>
                <Badge tone={row.state === "Pending" ? "warning" : "neutral"}>{row.state}</Badge>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Filters" icon={<Filter className="h-5 w-5" aria-hidden="true" />}>
          <div className="space-y-3">
            <label className="grid gap-2 text-sm font-medium">
              Activity
              <select className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option>All activity</option>
                <option>Sends</option>
                <option>Swaps</option>
                <option>Private payments</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Status
              <select className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option>All statuses</option>
                <option>Draft</option>
                <option>Signed</option>
                <option>Failed</option>
              </select>
            </label>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Privacy review"
        icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
      >
        <p className="text-sm leading-6 text-muted-foreground">
          Private payment records are surfaced as state summaries without exposing imported keys,
          seed phrases, or browser-held secrets.
        </p>
      </SectionCard>
    </>
  );
}
