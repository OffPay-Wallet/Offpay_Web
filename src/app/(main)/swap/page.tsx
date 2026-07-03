import { Route, Shuffle } from "lucide-react";

import { PageHeader } from "@/components/offpay/page-header";
import { SectionCard } from "@/components/offpay/section-card";
import { Button } from "@/components/ui/button";
import { truncateAddress } from "@/lib/offpay/display";

type SwapSearchParams = Promise<{
  amount?: string | string[];
  inputMint?: string | string[];
}>;

function readSingleParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function SwapPage({
  searchParams,
}: {
  searchParams: SwapSearchParams;
}) {
  const params = await searchParams;
  const inputMint = readSingleParam(params.inputMint);
  const amount = readSingleParam(params.amount);
  const hasDashboardDraft = inputMint.length > 0 || amount.length > 0;

  return (
    <>
      <PageHeader
        eyebrow="Swap"
        title="Swap workspace"
        description="Review dashboard-prepared swap details before quote support is enabled."
      />

      <SectionCard title="Dashboard swap" icon={<Shuffle className="h-5 w-5" aria-hidden="true" />}>
        {hasDashboardDraft ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Input mint
              </p>
              <p className="mt-2 font-mono text-sm font-semibold tabular-nums">
                {inputMint ? truncateAddress(inputMint, 6) : "--"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Amount
              </p>
              <p className="mt-2 font-mono text-sm font-semibold tabular-nums">
                {amount || "--"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Prepare a swap from the dashboard card after your wallet holdings load.
          </p>
        )}
        <Button type="button" className="mt-5 w-full" disabled>
          Worker quote route pending
        </Button>
      </SectionCard>

      <SectionCard title="Route review" icon={<Route className="h-5 w-5" aria-hidden="true" />}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold">Quote</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              The selected path returns as a signed-session draft.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold">Review</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Price impact and route risk are checked before signing.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold">Sign</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Execution waits for the connected wallet.
            </p>
          </div>
        </div>
      </SectionCard>
    </>
  );
}
