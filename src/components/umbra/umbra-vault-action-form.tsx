"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { UmbraVaultHolding, WalletPortfolio } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

import {
  type VaultAction,
  umbraVaultBalanceHint,
  validateUmbraVaultPreflight,
} from "./umbra-vault-validation";

type FeedbackTone = "danger" | "warning" | "success";

type VaultActionFormProps = {
  compact: boolean;
  holdings: UmbraVaultHolding[];
  isLoading: boolean;
  onPortfolioRetry: () => void;
  portfolio: WalletPortfolio | undefined;
  portfolioError: Error | null;
  portfolioLoading: boolean;
  walletReady: boolean;
};

const vaultActions = [
  { id: "shield", label: "Shield", Icon: ArrowDownLeft },
  { id: "unshield", label: "Unshield", Icon: ArrowUpRight },
] as const;

export function VaultActionForm({
  compact,
  holdings,
  isLoading,
  onPortfolioRetry,
  portfolio,
  portfolioError,
  portfolioLoading,
  walletReady,
}: VaultActionFormProps) {
  const [action, setAction] = useState<VaultAction>("shield");
  const [selectedMint, setSelectedMint] = useState("");
  const [amount, setAmount] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    retryBalances?: true;
    tone: FeedbackTone;
  } | null>(null);

  const selectedHolding = useMemo(
    () => holdings.find((row) => row.mint === selectedMint) ?? holdings[0] ?? null,
    [holdings, selectedMint],
  );
  const actionAllowed =
    selectedHolding == null
      ? false
      : action === "shield"
        ? selectedHolding.depositEnabled
        : selectedHolding.stealthPoolEnabled;
  const controlsDisabled = isLoading || holdings.length === 0;
  const submitDisabled = controlsDisabled || !actionAllowed;
  const submitLabel = selectedHolding
    ? `${action === "shield" ? "Shield" : "Unshield"} ${selectedHolding.symbol}`
    : action === "shield"
      ? "Shield"
      : "Unshield";
  const hint = umbraVaultBalanceHint({
    action,
    holding: selectedHolding,
    portfolio,
    portfolioError,
    portfolioLoading,
  });

  function clearMessages() {
    setFieldError(null);
    setFeedback(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const result = validateUmbraVaultPreflight({
      action,
      amount,
      holding: selectedHolding,
      portfolio,
      portfolioError,
      portfolioLoading,
      walletReady,
    });

    if (!result.ok) {
      if (result.field === "amount") {
        setFieldError(result.message);
        return;
      }

      setFieldError(null);
      setFeedback({
        message: result.message,
        tone: "danger",
        ...(result.retryBalances ? { retryBalances: true } : {}),
      });
      return;
    }

    setFieldError(null);
    setFeedback({
      tone: "warning",
      message: `${submitLabel} preflight passed. Transaction preparation still needs the web gateway endpoint.`,
    });
  }

  return (
    <form
      className={cn(
        "min-w-0",
        compact ? "space-y-4" : "rounded-lg border border-border bg-card p-5 text-card-foreground",
      )}
      onSubmit={handleSubmit}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold">Move funds</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {isLoading ? "Loading" : selectedHolding?.symbol ?? "Select token"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-full border border-border bg-background p-1">
        {vaultActions.map(({ id, label, Icon }) => {
          const selected = id === action;

          return (
            <button
              key={id}
              type="button"
              className={cn(
                "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
              aria-pressed={selected}
              onClick={() => {
                setAction(id);
                clearMessages();
              }}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {isLoading ? (
          <>
            <span className="h-10 w-16 rounded-full bg-muted motion-safe:animate-pulse" />
            <span className="h-10 w-20 rounded-full bg-muted motion-safe:animate-pulse" />
            <span className="h-10 w-20 rounded-full bg-muted motion-safe:animate-pulse" />
          </>
        ) : holdings.length > 0 ? (
          holdings.map((holding) => (
            <TokenButton
              key={holding.mint}
              holding={holding}
              selected={holding.mint === selectedHolding?.mint}
              onSelect={() => {
                setSelectedMint(holding.mint);
                clearMessages();
              }}
            />
          ))
        ) : (
          <span className="min-h-10 rounded-full border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            No tokens
          </span>
        )}
      </div>

      <label className="grid gap-2 text-sm font-medium">
        Amount
        <input
          className="h-11 rounded-lg border border-input bg-background px-3 font-mono text-sm tabular-nums outline-none transition-colors placeholder:text-muted-foreground/55 focus-visible:ring-2 focus-visible:ring-ring"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0.00"
          value={amount}
          disabled={controlsDisabled}
          aria-invalid={fieldError ? "true" : undefined}
          aria-describedby={fieldError ? "umbra-vault-amount-error" : undefined}
          onChange={(event) => {
            setAmount(event.target.value);
            clearMessages();
          }}
        />
      </label>

      <div className="min-h-5 text-xs text-muted-foreground">
        {fieldError ? (
          <p id="umbra-vault-amount-error" className="text-destructive">
            {fieldError}
          </p>
        ) : hint ? (
          <p>{hint}</p>
        ) : null}
      </div>

      {feedback ? (
        <FormFeedback feedback={feedback} onPortfolioRetry={onPortfolioRetry} />
      ) : null}

      <Button type="submit" className="w-full" disabled={submitDisabled}>
        {submitLabel}
      </Button>
    </form>
  );
}

function TokenButton({
  holding,
  onSelect,
  selected,
}: {
  holding: UmbraVaultHolding;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "min-h-10 rounded-full border px-3 text-sm font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {holding.symbol}
    </button>
  );
}

function FormFeedback({
  feedback,
  onPortfolioRetry,
}: {
  feedback: {
    message: string;
    retryBalances?: true;
    tone: FeedbackTone;
  };
  onPortfolioRetry: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-xs",
        feedback.tone === "danger"
          ? "border-destructive/35 bg-destructive/10 text-destructive"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
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
