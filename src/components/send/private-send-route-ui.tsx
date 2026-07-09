import { CheckCircle2, Route, ShieldCheck } from "lucide-react";

import { SectionCard } from "@/components/offpay/section-card";
import { Badge } from "@/components/ui/badge";
import { truncateAddress } from "@/lib/offpay/display";
import type { PrivateSendProvider } from "@/lib/offpay/private-send";
import { cn } from "@/lib/utils";

export type PrivateSendResult = {
  amountLabel: string;
  provider: PrivateSendProvider;
  signatureLabel: string | null;
};

const providerOptions = [
  {
    description: "Private Ephemeral Rollup",
    id: "magicblock",
    label: "MagicBlock",
  },
  {
    description: "Stealth Pool note",
    id: "umbra",
    label: "Umbra",
  },
] satisfies Array<{
  description: string;
  id: PrivateSendProvider;
  label: string;
}>;

function selectedProviderLabel(provider: PrivateSendProvider): string {
  return provider === "magicblock" ? "MagicBlock" : "Umbra";
}

export function PrivateSendRouteSelector({
  onProviderChange,
  provider,
}: {
  onProviderChange: (provider: PrivateSendProvider) => void;
  provider: PrivateSendProvider;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium">Provider route</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {providerOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={provider === option.id}
            onClick={() => onProviderChange(option.id)}
            className={cn(
              "min-h-20 rounded-lg border bg-background p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              provider === option.id
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-accent",
            )}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{option.label}</span>
              <Route className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <span className="mt-2 block text-xs text-muted-foreground">
              {option.description}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function PrivateSendResultBanner({ result }: { result: PrivateSendResult }) {
  return (
    <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
      <span className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        Sent {result.amountLabel} through {selectedProviderLabel(result.provider)}
      </span>
      {result.signatureLabel ? (
        <span className="mt-1 block font-mono text-xs tabular-nums">
          {result.signatureLabel}
        </span>
      ) : null}
    </div>
  );
}

export function PrivateSendRouteBoundary({
  cluster,
  provider,
  walletAddress,
  walletsReady,
}: {
  cluster: string;
  provider: PrivateSendProvider;
  walletAddress: string | null;
  walletsReady: boolean;
}) {
  return (
    <SectionCard
      title="Route boundary"
      icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="flex flex-wrap gap-2">
        <Badge tone={provider === "magicblock" ? "success" : "neutral"}>MagicBlock</Badge>
        <Badge tone={provider === "umbra" ? "success" : "neutral"}>Umbra</Badge>
        <Badge>{cluster.replace("solana:", "")}</Badge>
        {walletsReady && walletAddress ? <Badge>{truncateAddress(walletAddress)}</Badge> : null}
      </div>
    </SectionCard>
  );
}
