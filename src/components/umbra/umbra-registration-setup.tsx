"use client";

import { useState } from "react";
import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import { AlertCircle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  executeUmbraVaultRegistration,
  umbraVaultExecutionMessage,
} from "@/lib/offpay/umbra-vault-execution";
import type { SolanaCluster } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

type SetupStatus = "required" | "ready";

type UmbraRegistrationSetupProps = {
  activeWallet: ConnectedStandardSolanaWallet | undefined;
  checkError: Error | null;
  cluster: SolanaCluster;
  disabled: boolean;
  gatewayOrigin: string | undefined;
  isChecking: boolean;
  onReadyChange: (ready: boolean) => void;
  onRetry: () => void;
  onSetupComplete: () => void;
  walletReady: boolean;
};

export function UmbraRegistrationSetup({
  activeWallet,
  checkError,
  cluster,
  disabled,
  gatewayOrigin,
  isChecking,
  onReadyChange,
  onRetry,
  onSetupComplete,
  walletReady,
}: UmbraRegistrationSetupProps) {
  const [status, setStatus] = useState<SetupStatus>("required");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"danger" | "success">("success");
  const setupDisabled =
    disabled || isSubmitting || isChecking || !walletReady || !activeWallet || !gatewayOrigin;
  const retryDisabled =
    disabled || isChecking || !walletReady || !activeWallet || !gatewayOrigin;
  const isCheckFailed = Boolean(checkError);
  const title = isChecking
    ? "Checking vault"
    : isCheckFailed
      ? "Check failed"
      : status === "ready"
        ? "Vault ready"
        : "Set up vault";
  const description = isChecking
    ? "Validating Umbra registration."
    : isCheckFailed
      ? "Unable to validate registration."
      : "Register this wallet for encrypted balances.";
  const buttonLabel = isChecking
    ? "Checking..."
    : isCheckFailed
      ? "Retry"
      : isSubmitting
        ? "Setting up..."
        : status === "ready"
          ? "Ready"
          : "Set up";
  const displayedMessage = checkError?.message ?? message;
  const displayedTone = checkError ? "danger" : messageTone;

  async function handleSetup() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const result = await executeUmbraVaultRegistration({
        cluster,
        gatewayOrigin,
        wallet: activeWallet,
      });

      setStatus("ready");
      setMessageTone("success");
      setMessage(
        result.signatureLabel
          ? `Vault ready (${result.signatureLabel}).`
          : "Vault ready.",
      );
      onReadyChange(true);
      onSetupComplete();
    } catch (error) {
      setStatus("required");
      setMessageTone("danger");
      setMessage(umbraVaultExecutionMessage(error));
      onReadyChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between",
        status === "ready" && "border-emerald-500/30 bg-emerald-500/5",
      )}
      aria-label="Umbra vault setup"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground",
            status === "ready" && "bg-emerald-500/15 text-emerald-400",
          )}
          aria-hidden="true"
        >
          {isChecking ? (
            <RefreshCw className="h-4 w-4 motion-safe:animate-spin" />
          ) : status === "ready" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isCheckFailed ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          {displayedMessage ? (
            <p
              className={cn(
                "mt-2 flex items-start gap-1.5 text-xs",
                displayedTone === "danger" ? "text-destructive" : "text-emerald-400",
              )}
            >
              {displayedTone === "danger" ? (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : null}
              <span>{displayedMessage}</span>
            </p>
          ) : null}
        </div>
      </div>

      <Button
        type="button"
        variant={status === "ready" || isCheckFailed ? "outline" : "primary"}
        className="h-9 shrink-0"
        disabled={isCheckFailed ? retryDisabled : setupDisabled || status === "ready"}
        aria-busy={isSubmitting || isChecking ? "true" : undefined}
        onClick={isCheckFailed ? onRetry : handleSetup}
      >
        {buttonLabel}
      </Button>
    </section>
  );
}
