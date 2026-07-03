import { LockKeyhole, Route, Settings2, Shuffle } from "lucide-react";

import { PageHeader } from "@/components/offpay/page-header";
import { SectionCard } from "@/components/offpay/section-card";
import { SwapModeCard } from "@/components/offpay/swap-mode-card";
import { Button } from "@/components/ui/button";

const swapModes = [
  {
    label: "Normal swap",
    description: "Best-route quote for standard token swaps with review before execution.",
    icon: Shuffle,
    tone: "success",
  },
  {
    label: "Private swap",
    description: "Privacy-preserving swap draft routed through the protected payment flow.",
    icon: LockKeyhole,
    tone: "neutral",
  },
  {
    label: "Advanced swap",
    description: "Manual controls for route preference, expiry, and slippage review.",
    icon: Settings2,
    tone: "warning",
  },
] as const;

export default function SwapPage() {
  return (
    <>
      <PageHeader
        eyebrow="Swap"
        title="Swap workspace"
        description="Normal, private, and advanced swaps are prepared from one screen."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        {swapModes.map((mode) => {
          const Icon = mode.icon;

          return (
            <SwapModeCard
              key={mode.label}
              label={mode.label}
              description={mode.description}
              tone={mode.tone}
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="grid gap-3">
                <label className="grid gap-2 text-sm font-medium">
                  From
                  <select className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option>SOL</option>
                    <option>USDC</option>
                    <option>USDT</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  To
                  <select className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option>USDC</option>
                    <option>SOL</option>
                    <option>USDT</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Amount
                  <input
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </label>
              </div>
              {mode.label === "Advanced swap" ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <label className="grid gap-2 text-sm font-medium">
                    Slippage
                    <select className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option>0.5%</option>
                      <option>1.0%</option>
                      <option>Custom</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Expiry
                    <select className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option>2 minutes</option>
                      <option>5 minutes</option>
                      <option>10 minutes</option>
                    </select>
                  </label>
                </div>
              ) : null}
              <Button type="button" className="mt-5 w-full" disabled>
                Prepare quote
              </Button>
            </SwapModeCard>
          );
        })}
      </div>

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
