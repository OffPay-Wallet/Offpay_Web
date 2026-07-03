import { LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";

import { PageHeader } from "@/components/offpay/page-header";
import { SectionCard } from "@/components/offpay/section-card";
import { Badge } from "@/components/ui/badge";

const vaultRows = [
  {
    label: "Wallet access",
    value: "Privy or external",
  },
  {
    label: "Network access",
    value: "Protected",
  },
  {
    label: "Key imports",
    value: "Disabled",
  },
] as const;

const assetRows = [
  {
    symbol: "SOL",
    description: "Gas and settlement balance",
    state: "Wallet connected",
  },
  {
    symbol: "USDC",
    description: "Stablecoin payments",
    state: "Wallet connected",
  },
  {
    symbol: "USDT",
    description: "Stablecoin payments",
    state: "Wallet connected",
  },
] as const;

export default function VaultPage() {
  return (
    <>
      <PageHeader
        eyebrow="Vault"
        title="Wallet vault"
        description="Balances and custody state stay protected behind your signed wallet session."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard
          title="Assets"
          icon={<WalletCards className="h-5 w-5" aria-hidden="true" />}
        >
          <div className="divide-y divide-border rounded-lg border border-border">
            {assetRows.map((asset) => (
              <div
                key={asset.symbol}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold">{asset.symbol}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {asset.description}
                  </p>
                </div>
                <Badge>{asset.state}</Badge>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Vault policy"
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
        >
          <div className="space-y-3">
            {vaultRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="text-right text-sm font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Private balance controls"
        icon={<LockKeyhole className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold">Shielded receives</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Private payment claims are prepared as review drafts.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold">Session-scoped reads</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Account data is available after wallet session verification.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm font-semibold">No seed handling</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Private keys, seed phrases, and wallet imports are excluded from the web app.
            </p>
          </div>
        </div>
      </SectionCard>
    </>
  );
}
