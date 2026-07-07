"use client";

import { type FormEvent, useMemo, useState } from "react";
import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";

import { Button } from "@/components/ui/button";
import {
  executeUmbraVaultAction,
  umbraVaultExecutionMessage,
} from "@/lib/offpay/umbra-vault-execution";
import { debugError } from "@/lib/offpay/debug";
import type {
  SolanaCluster,
  UmbraVaultHolding,
  UmbraVaultRegistrationStatus,
  WalletPortfolio,
  WalletTokenMetadata,
} from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

import { UmbraActionToggle } from "./umbra-action-toggle";
import { UmbraAmountField } from "./umbra-amount-field";
import { UmbraRegistrationSetup } from "./umbra-registration-setup";
import { FormFeedback, UmbraVaultSummary, type FeedbackTone } from "./umbra-vault-summary";
import {
  decimalToAtomic,
  formatAtomicAmount,
  type VaultAction,
  umbraVaultAvailableAtomic,
  validateUmbraVaultPreflight,
} from "./umbra-vault-validation";

type VaultActionFormProps = {
  activeWallet: ConnectedStandardSolanaWallet | undefined;
  cluster: SolanaCluster;
  compact: boolean;
  gatewayOrigin: string | undefined;
  holdings: UmbraVaultHolding[];
  isLoading: boolean;
  logoByMint: Record<string, WalletTokenMetadata>;
  onActionComplete: () => void;
  onPortfolioRetry: () => void;
  onRegistrationRetry: () => void;
  portfolio: WalletPortfolio | undefined;
  portfolioError: Error | null;
  portfolioLoading: boolean;
  registrationError: Error | null;
  registrationLoading: boolean;
  registrationStatus: UmbraVaultRegistrationStatus | undefined;
  feeReserveLamports: bigint | null;
  walletReady: boolean;
};

const quickFillDenominator = 100n;

export function VaultActionForm({
  activeWallet,
  cluster,
  compact,
  gatewayOrigin,
  holdings,
  isLoading,
  logoByMint,
  onActionComplete,
  onPortfolioRetry,
  onRegistrationRetry,
  portfolio,
  portfolioError,
  portfolioLoading,
  registrationError,
  registrationLoading,
  registrationStatus,
  feeReserveLamports,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [readyVaultKey, setReadyVaultKey] = useState<string | null>(null);
  const vaultSetupKey = `${cluster}:${gatewayOrigin ?? ""}:${activeWallet?.address ?? ""}`;
  const registrationReady =
    registrationStatus?.registered === true || readyVaultKey === vaultSetupKey;

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
  const controlsDisabled = isLoading || holdings.length === 0 || isSubmitting;
  const submitDisabled = controlsDisabled || !actionAllowed || !registrationReady;
  // Only render the setup block once we positively know the wallet is
  // unregistered (or the check errored). While the status is still loading we
  // keep it hidden so registered wallets never see it flash in and collapse —
  // that flash was the main layout shift.
  const showRegistrationSetup =
    !registrationReady && (registrationStatus?.registered === false || Boolean(registrationError));
  const submitLabel = selectedHolding
    ? `${action === "shield" ? "Shield" : "Unshield"} ${selectedHolding.symbol}`
    : action === "shield"
      ? "Shield"
      : "Unshield";
  const pendingLabel = selectedHolding
    ? `${action === "shield" ? "Shielding" : "Unshielding"} ${selectedHolding.symbol}...`
    : "Confirming...";

  const availableAtomic = useMemo(
    () => umbraVaultAvailableAtomic({ action, feeReserveLamports, holding: selectedHolding, portfolio }),
    [action, feeReserveLamports, selectedHolding, portfolio],
  );
  const decimals = selectedHolding?.decimals ?? null;
  const availableEnabled = availableAtomic != null && availableAtomic > 0n && decimals != null;
  const availableLabel =
    availableAtomic != null && decimals != null
      ? formatAtomicAmount(availableAtomic, decimals)
      : null;
  const feeReserveLabel =
    feeReserveLamports && feeReserveLamports > 0n
      ? `${formatAtomicAmount(feeReserveLamports, 9)} SOL`
      : null;

  // Proactively reflect amount/balance validity on the CTA (Uniswap-style) so
  // the user sees "Insufficient …" before submitting rather than after.
  const amountAtomicValue = useMemo(
    () => (decimals != null ? decimalToAtomic(amount, decimals) : null),
    [amount, decimals],
  );
  const hasPositiveAmount = amountAtomicValue != null && amountAtomicValue > 0n;
  const canEnterAmount = registrationReady && actionAllowed && !controlsDisabled;
  const noBalance = canEnterAmount && availableAtomic != null && availableAtomic <= 0n;
  const insufficientBalance =
    canEnterAmount &&
    hasPositiveAmount &&
    availableAtomic != null &&
    amountAtomicValue > availableAtomic;
  const showBalanceError = noBalance || insufficientBalance;

  function clearMessages() {
    setFieldError(null);
    setFeedback(null);
  }

  function handleQuickFill(fraction: number) {
    if (availableAtomic == null || decimals == null) return;

    const numerator = BigInt(Math.round(fraction * 100));
    const target = (availableAtomic * numerator) / quickFillDenominator;
    setAmount(formatAtomicAmount(target, decimals));
    clearMessages();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const result = validateUmbraVaultPreflight({
      action,
      amount,
      feeReserveLamports,
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

    if (selectedHolding?.decimals == null) {
      setFeedback({
        message: "Token decimals are unavailable. Refresh vault.",
        tone: "danger",
      });
      return;
    }

    const amountAtomic = decimalToAtomic(amount, selectedHolding.decimals);
    if (amountAtomic == null) {
      setFieldError(`Use a valid ${selectedHolding.symbol} amount.`);
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);

    try {
      const submitted = await executeUmbraVaultAction({
        action,
        amountAtomic,
        cluster,
        gatewayOrigin,
        holding: selectedHolding,
        wallet: activeWallet,
      });

      setFeedback({
        tone: "success",
        message: submitted.signatureLabel
          ? `${submitLabel} submitted (${submitted.signatureLabel}).`
          : `${submitLabel} submitted.`,
      });
      setAmount("");
      onActionComplete();
    } catch (error) {
      const message = umbraVaultExecutionMessage(error);
      debugError("umbra.vault_action.failed", {
        action,
        code: error instanceof Error ? error.name : typeof error,
        reason: message,
        symbol: selectedHolding.symbol,
      });
      setFeedback({ message, tone: "danger" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className={cn(
        "min-w-0 space-y-3",
        // Flat, borderless, elevation-free translucent glass: a faint frosted
        // sheen lets the background read through while the backdrop blur keeps
        // content legible. Extra-large radius gives the soft, feathered corners.
        compact
          ? ""
          : "rounded-[1.75rem] bg-gradient-to-br from-background/75 to-background/60 p-5 text-card-foreground backdrop-blur-xl",
      )}
      onSubmit={handleSubmit}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">Move funds</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Shield into privacy or unshield back to your wallet.
        </p>
      </div>

      {showRegistrationSetup ? (
        <UmbraRegistrationSetup
          key={vaultSetupKey}
          activeWallet={activeWallet}
          checkError={registrationError}
          cluster={cluster}
          disabled={isSubmitting}
          gatewayOrigin={gatewayOrigin}
          isChecking={registrationLoading}
          onReadyChange={(ready) => {
            setReadyVaultKey(ready ? vaultSetupKey : null);
          }}
          onRetry={onRegistrationRetry}
          onSetupComplete={onActionComplete}
          walletReady={walletReady}
        />
      ) : null}

      <UmbraActionToggle
        action={action}
        disabled={controlsDisabled}
        onChange={(next) => {
          setAction(next);
          clearMessages();
        }}
      />

      <UmbraAmountField
        amount={amount}
        availableEnabled={availableEnabled}
        availableLabel={availableLabel}
        disabled={controlsDisabled}
        hasError={Boolean(fieldError)}
        holdings={holdings}
        label={action === "shield" ? "You're shielding" : "You're unshielding"}
        logoByMint={logoByMint}
        onAmountChange={(value) => {
          setAmount(value);
          clearMessages();
        }}
        onQuickFill={handleQuickFill}
        onSelectHolding={(mint) => {
          setSelectedMint(mint);
          clearMessages();
        }}
        selectedHolding={selectedHolding}
      />

      <div className="min-h-4 text-xs">
        {fieldError ? (
          <p id="umbra-vault-amount-error" className="text-destructive">
            {fieldError}
          </p>
        ) : null}
      </div>

      <UmbraVaultSummary action={action} feeReserveLabel={feeReserveLabel} />

      {feedback ? (
        <FormFeedback feedback={feedback} onPortfolioRetry={onPortfolioRetry} />
      ) : null}

      <Button
        type="submit"
        className={cn(
          "h-12 w-full rounded-2xl text-sm",
          showBalanceError &&
            "bg-destructive/20 text-destructive disabled:opacity-100 shadow-[0_0_30px_-6px_var(--offpay-color-red)] [text-shadow:0_0_14px_color-mix(in_srgb,var(--offpay-color-red)_65%,transparent)]",
        )}
        disabled={submitDisabled || !hasPositiveAmount || showBalanceError}
        loading={isSubmitting}
      >
        {isSubmitting
          ? pendingLabel
          : showBalanceError
            ? selectedHolding
              ? `Insufficient ${selectedHolding.symbol}`
              : "Insufficient balance"
            : canEnterAmount && !hasPositiveAmount
              ? "Enter an amount"
              : submitLabel}
      </Button>
    </form>
  );
}
