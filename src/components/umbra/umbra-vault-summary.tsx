"use client";

import { AlertCircle, ArrowRight, CheckCircle2, RefreshCw, ShieldCheck, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { VaultAction } from "./umbra-vault-validation";

export type FeedbackTone = "danger" | "warning" | "success";

type RouteEndpoint = { Icon: typeof Wallet; label: string };

function routeEndpoints(action: VaultAction): { from: RouteEndpoint; to: RouteEndpoint } {
  const wallet: RouteEndpoint = { Icon: Wallet, label: "Wallet" };
  const shielded: RouteEndpoint = { Icon: ShieldCheck, label: "Private" };

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
    <div className="divide-y divide-white/[0.06] rounded-2xl bg-white/[0.04] text-xs">
      <div className="flex h-10 items-center justify-between gap-3 px-3">
        <span className="text-muted-foreground">Route</span>
        <span
          key={action}
          className="flex min-w-0 items-center gap-1.5 font-medium text-foreground duration-200 ease-out motion-safe:animate-in motion-safe:fade-in-0"
        >
          <Endpoint Icon={from.Icon} label={from.label} muted />
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Endpoint Icon={to.Icon} label={to.label} />
        </span>
      </div>
      <div className="flex h-10 items-center justify-between gap-3 px-3">
        <span className="text-muted-foreground">
          {isShield ? "Network reserve" : "Visibility"}
        </span>
        {isShield ? (
          <span className="font-mono tabular-nums text-foreground/90">
            {feeReserveLabel ?? "—"}
          </span>
        ) : (
          <span className="font-medium text-foreground/90">Public on-chain</span>
        )}
      </div>
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
        "inline-flex min-w-0 items-center gap-1",
        muted ? "text-muted-foreground" : "text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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
        "flex items-start gap-2 rounded-2xl p-3 text-xs",
        "duration-200 ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1",
        isDanger
          ? "bg-destructive/15 text-destructive"
          : isSuccess
            ? "bg-gain/15 text-gain"
            : "bg-muted text-muted-foreground",
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
