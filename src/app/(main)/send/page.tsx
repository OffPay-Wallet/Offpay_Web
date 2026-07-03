import { LockKeyhole, Send, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/offpay/page-header";
import { SectionCard } from "@/components/offpay/section-card";
import { Button } from "@/components/ui/button";

const paymentModes = [
  {
    title: "Normal send",
    description: "SOL or SPL transfer draft with recipient, asset, amount, and memo review.",
    icon: Send,
  },
  {
    title: "Private send",
    description: "Shielded payment draft with private route preparation before wallet signing.",
    icon: LockKeyhole,
  },
] as const;

export default function SendPage() {
  return (
    <>
      <PageHeader
        eyebrow="Send"
        title="Create a payment draft"
        description="Normal and private sends share one review-first screen before a wallet signature."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {paymentModes.map((mode) => {
          const Icon = mode.icon;

          return (
            <SectionCard
              key={mode.title}
              title={mode.title}
              icon={<Icon className="h-5 w-5" aria-hidden="true" />}
            >
              <p className="text-sm leading-6 text-muted-foreground">{mode.description}</p>
              <div className="mt-5 grid gap-3">
                <label className="grid gap-2 text-sm font-medium">
                  Recipient
                  <input
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Solana address"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">
                    Asset
                    <select className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option>SOL</option>
                      <option>USDC</option>
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
                <label className="grid gap-2 text-sm font-medium">
                  Memo
                  <input
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Optional"
                  />
                </label>
              </div>
              <Button type="button" className="mt-5 w-full" disabled>
                Prepare draft
              </Button>
            </SectionCard>
          );
        })}
      </div>

      <SectionCard
        title="Signature boundary"
        icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
      >
        <p className="text-sm leading-6 text-muted-foreground">
          Payment drafts stay unsigned until the connected wallet confirms the transaction.
        </p>
      </SectionCard>
    </>
  );
}
