"use client";

import { useState } from "react";
import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";

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
  cluster: SolanaCluster;
  disabled: boolean;
  gatewayOrigin: string | undefined;
  onReadyChange: (ready: boolean) => void;
  onSetupComplete: () => void;
  walletReady: boolean;
};

export function UmbraRegistrationSetup({
  activeWallet,
  cluster,
  disabled,
  gatewayOrigin,
  onReadyChange,
  onSetupComplete,
  walletReady,
}: UmbraRegistrationSetupProps) {
  const [status, setStatus] = useState<SetupStatus>("required");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"danger" | "success">("success");
  const setupDisabled =
    disabled || isSubmitting || !walletReady || !activeWallet || !gatewayOrigin;

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
          {status === "ready" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {status === "ready" ? "Vault ready" : "Set up vault"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Register this wallet for encrypted balances.
          </p>
          {message ? (
            <p
              className={cn(
                "mt-2 flex items-start gap-1.5 text-xs",
                messageTone === "danger" ? "text-destructive" : "text-emerald-400",
              )}
            >
              {messageTone === "danger" ? (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : null}
              <span>{message}</span>
            </p>
          ) : null}
        </div>
      </div>

      <Button
        type="button"
        variant={status === "ready" ? "outline" : "primary"}
        className="h-9 shrink-0"
        disabled={setupDisabled || status === "ready"}
        aria-busy={isSubmitting ? "true" : undefined}
        onClick={handleSetup}
      >
        {isSubmitting ? "Setting up..." : status === "ready" ? "Ready" : "Set up"}
      </Button>
    </section>
  );
}
