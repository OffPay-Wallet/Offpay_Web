"use client";

import { AlertCircle, ArrowRight, CheckCircle2, RefreshCw, ShieldCheck, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { VaultAction } from "./umbra-vault-validation";

export type FeedbackTone = "danger" | "warning" | "success";

type RouteEndpoint = { Icon: typeof Wallet; label: string };

function routeEndpoints(action: VaultAction): { from: RouteEndpoint; to: RouteEndpoint } {
  const wallet: RouteEndpoint = { Icon: Wallet, label: "Public wallet" };
  const shielded: RouteEndpoint = { Icon: ShieldCheck, label: "Encrypted balance" };

  return action === "shield"
    ? { from: wallet, to: shielded }
    : { from: shielded, to: wallet };
}

/**
 * Route + fee summary. The from/to endpoints crossfade when the action flips,
 * which mirrors the segmented toggle rather than animating on idle.
 */
export function UmbraVaultSummary({
  action,
  feeReserveLabel,
}: {
  action: VaultAction;
  feeReserveLabel: string | null;
}) {
  const { from, to } = routeEndpoints(action);
  const isShield = action === "shield";

  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/15 p-4">
      <div
        key={action}
        className="flex items-center justify-between gap-3 duration-200 ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
      >
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Endpoint Icon={from.Icon} label={from.label} muted />
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Endpoint Icon={to.Icon} label={to.label} />
        </div>
        <Badge tone={isShield ? "success" : "neutral"} className="shrink-0">
          {isShield ? "Private" : "Public"}
        </Badge>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {isShield
          ? "Funds move into your encrypted balance. Amounts stay private on-chain."
          : "Funds return to your public wallet and become visible on-chain."}
        {feeReserveLabel ? (
          <>
            {" "}
            Keep at least{" "}
            <span className="font-mono tabular-nums text-foreground/80">{feeReserveLabel}</span> for
            setup and network fees.
          </>
        ) : null}
      </p>
    </div>
  );
}

function Endpoint({
  Icon,
  label,
  muted = false,
}: {
  Icon: typeof Wallet;
  label: string;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 font-medium",
        muted ? "text-muted-foreground" : "text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function FormFeedback({
  feedback,
  onPortfolioRetry,
}: {
  feedback: { message: string; retryBalances?: true; tone: FeedbackTone };
  onPortfolioRetry: () => void;
}) {
  const isDanger = feedback.tone === "danger";
  const isSuccess = feedback.tone === "success";
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;

  return (
    <div
      role={isDanger ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-2xl border p-3 text-xs",
        "duration-200 ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
        isDanger
          ? "border-destructive/35 bg-destructive/10 text-destructive"
          : isSuccess
            ? "border-gain/35 bg-gain/10 text-gain"
            : "border-border bg-muted text-muted-foreground",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-2">
        <p className="leading-5">{feedback.message}</p>
        {feedback.retryBalances ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-2"
            onClick={onPortfolioRetry}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}
