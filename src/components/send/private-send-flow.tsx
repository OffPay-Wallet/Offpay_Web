"use client";

import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useMemo, useState } from "react";

import {
  privateSendPrimaryLabel,
  type PrivateSendFlowStep,
} from "@/components/send/private-send-form-utils";
import {
  runMagicBlockPrivateSend,
  runUmbraRoutePrivateSend,
} from "@/components/send/private-send-execution";
import {
  PrivateSendAmountCard,
  PrivateSendFeeSummary,
  PrivateSendRecipientCard,
  PrivateSendResultBanner,
  PrivateSendRouteSelector,
  type PrivateSendResult,
} from "@/components/send/private-send-route-ui";
import { usePrivateSendFeePreview } from "@/components/send/use-private-send-fee-preview";
import { Button } from "@/components/ui/button";
import { useSolanaWalletAccount } from "@/hooks/use-solana-wallet-account";
import { getErrorMessage } from "@/lib/offpay/display";
import {
  readGatewayPublicBalances,
  readGatewayUmbraVaultHoldings,
} from "@/lib/offpay/gateway-client";
import { formatFiatValue } from "@/lib/offpay/number-format";
import {
  formatAtomicTokenAmount,
  parseTokenAmountToAtomic,
  privateSendTokensForCluster,
  type PrivateSendProvider,
  validateSolanaAddress,
} from "@/lib/offpay/private-send";
import { getGatewayOrigin, getPublicSolanaCluster } from "@/lib/offpay/public-config";
import { umbraVaultExecutionMessage } from "@/lib/offpay/umbra-vault-execution";

export function PrivateSendFlow() {
  const {
    activeWallet,
    authenticated,
    walletAddress,
    walletCustody,
  } = useSolanaWalletAccount();
  const cluster = getPublicSolanaCluster();
  const gatewayOrigin = getGatewayOrigin();
  const tokens = privateSendTokensForCluster(cluster);
  const [provider, setProvider] = useState<PrivateSendProvider>("magicblock");
  const [recipient, setRecipient] = useState("");
  const [mint, setMint] = useState(tokens[0]?.mint ?? "");
  const [amount, setAmount] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [step, setStep] = useState<PrivateSendFlowStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrivateSendResult | null>(null);
  const selectedToken = tokens.find((token) => token.mint === mint) ?? tokens[0] ?? null;

  const umbraHoldingsQuery = useQuery({
    enabled: Boolean(gatewayOrigin && walletAddress && provider === "umbra"),
    queryKey: ["private-send-umbra-holdings", gatewayOrigin, cluster, walletAddress],
    queryFn: async () => {
      if (!gatewayOrigin || !walletAddress) {
        throw new Error("Gateway origin or wallet is not configured.");
      }

      const envelope = await readGatewayUmbraVaultHoldings(gatewayOrigin, {
        network: cluster,
        walletAddress,
      });

      if (!envelope.ok) throw new Error(envelope.error.message);
      return envelope.data;
    },
  });
  const umbraSupportedMints = useMemo(
    () => new Set(umbraHoldingsQuery.data?.holdings.map((holding) => holding.mint) ?? []),
    [umbraHoldingsQuery.data],
  );
  const publicBalancesQuery = useQuery({
    enabled: Boolean(gatewayOrigin && walletAddress),
    queryKey: ["private-send-public-balances", gatewayOrigin, cluster, walletAddress],
    queryFn: async () => {
      if (!gatewayOrigin || !walletAddress) {
        throw new Error("Gateway origin or wallet is not configured.");
      }

      const envelope = await readGatewayPublicBalances(gatewayOrigin, {
        network: cluster,
        walletAddress,
      });

      if (!envelope.ok) throw new Error(envelope.error.message);
      return envelope.data;
    },
  });
  const parsedAmount =
    selectedToken == null
      ? { error: "Select a supported token." }
      : parseTokenAmountToAtomic(amount, selectedToken.decimals);
  const recipientError = validateSolanaAddress(recipient);
  const amountError = "error" in parsedAmount ? parsedAmount.error : null;
  const amountAtomic = "amountAtomic" in parsedAmount ? parsedAmount.amountAtomic : null;
  const providerError =
    provider === "umbra" &&
    selectedToken &&
    umbraHoldingsQuery.isSuccess &&
    !umbraSupportedMints.has(selectedToken.mint)
      ? `${selectedToken.symbol} is not available through Umbra on this network.`
      : null;
  let selectedBalanceAtomic: bigint | null = null;
  if (selectedToken && publicBalancesQuery.data) {
    const tokenBalance = publicBalancesQuery.data.tokens.find(
      (token) => token.mint === selectedToken.mint,
    );

    try {
      selectedBalanceAtomic = BigInt(tokenBalance?.amount ?? "0");
    } catch {
      selectedBalanceAtomic = null;
    }
  }
  const selectedBalanceLabel =
    selectedBalanceAtomic != null && selectedToken
      ? formatAtomicTokenAmount(selectedBalanceAtomic, selectedToken.decimals)
      : null;
  const selectedBalanceUnavailable =
    publicBalancesQuery.isError || (!publicBalancesQuery.isLoading && selectedBalanceAtomic == null);
  const insufficientBalance =
    amountAtomic != null && selectedBalanceAtomic != null && amountAtomic > selectedBalanceAtomic;
  const feePreview = usePrivateSendFeePreview({
    activeWallet,
    amountAtomic,
    cluster,
    enabled: Boolean(
      authenticated &&
        gatewayOrigin &&
        selectedToken &&
        amountAtomic &&
        !recipientError &&
        !amountError &&
        !providerError,
    ),
    gatewayOrigin,
    memo: "",
    provider,
    recipient,
    selectedToken,
    walletCustody,
  });
  const canSubmit = Boolean(
    authenticated &&
      activeWallet &&
      gatewayOrigin &&
      walletCustody &&
      selectedToken &&
      !recipientError &&
      !amountError &&
      !providerError &&
      !insufficientBalance &&
      feePreview.isReady &&
      step !== "session" &&
      step !== "prepare" &&
      step !== "sign" &&
      step !== "submit",
  );
  const amountFiatLabel =
    amountAtomic && feePreview.tokenPriceUsd
      ? formatFiatValue((Number(amountAtomic) / 10 ** (selectedToken?.decimals ?? 0)) * feePreview.tokenPriceUsd)
      : "$0.00";
  const primaryActionLabel = privateSendPrimaryLabel({
    amount,
    amountError,
    authenticated,
    feeLoading: feePreview.isLoading,
    insufficientBalance,
    providerError,
    recipientError,
    selectedToken,
    step,
  });

  async function submitPrivateSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    setError(null);
    setResult(null);

    if (!activeWallet || !walletCustody) {
      setError("Connect a Solana wallet first.");
      return;
    }

    if (!gatewayOrigin) {
      setError("Gateway origin is not configured.");
      return;
    }

    if (!selectedToken || recipientError || amountError || providerError) return;
    if (insufficientBalance) return;

    const submitAmountAtomic = amountAtomic ?? 0n;
    const amountLabel = `${formatAtomicTokenAmount(submitAmountAtomic, selectedToken.decimals)} ${
      selectedToken.symbol
    }`;

    try {
      if (provider === "magicblock") {
        setResult(
          await runMagicBlockPrivateSend({
            activeWallet,
            amountAtomic: submitAmountAtomic,
            amountLabel,
            cluster,
            draft: feePreview.magicBlockDraft,
            gatewayOrigin,
            recipient,
            selectedToken,
            setStep,
            walletCustody,
          }),
        );
      } else {
        setResult(
          await runUmbraRoutePrivateSend({
            activeWallet,
            amountAtomic: submitAmountAtomic,
            amountLabel,
            cluster,
            gatewayOrigin,
            recipient,
            selectedToken,
            setStep,
          }),
        );
      }
      setStep("success");
    } catch (caught) {
      setStep("idle");
      setError(provider === "umbra" ? umbraVaultExecutionMessage(caught) : getErrorMessage(caught));
    }
  }

  async function pasteRecipient() {
    try {
      const value = await navigator.clipboard.readText();
      if (value.trim()) {
        setRecipient(value.trim());
        setError(null);
      }
    } catch {
      setError("Clipboard permission was denied.");
    }
  }

  return (
    <form
      onSubmit={submitPrivateSend}
      className="mx-auto flex w-full max-w-3xl flex-col gap-5"
    >
      <PrivateSendAmountCard
        amount={amount}
        balanceLabel={selectedBalanceLabel}
        balanceLoading={publicBalancesQuery.isLoading || publicBalancesQuery.isFetching}
        balanceUnavailable={selectedBalanceUnavailable}
        canUseMax={selectedBalanceAtomic != null && selectedBalanceAtomic > 0n}
        fiatLabel={amountFiatLabel}
        hasError={attempted && Boolean(amountError)}
        onAmountChange={(value) => {
          setAmount(value);
          setResult(null);
          setError(null);
        }}
        onMax={() => {
          if (selectedBalanceAtomic != null && selectedToken) {
            setAmount(formatAtomicTokenAmount(selectedBalanceAtomic, selectedToken.decimals));
            setResult(null);
            setError(null);
          }
        }}
        onMintChange={(nextMint) => {
          setMint(nextMint);
          setResult(null);
          setError(null);
        }}
        selectedMint={mint}
        selectedToken={selectedToken}
        tokens={tokens}
      />
      {attempted && amountError ? (
        <p id="private-send-amount-error" className="px-1 text-xs text-destructive">
          {amountError}
        </p>
      ) : null}

      <PrivateSendRecipientCard
        error={attempted && recipientError ? recipientError : null}
        onPaste={pasteRecipient}
        onRecipientChange={(value) => {
          setRecipient(value);
          setResult(null);
          setError(null);
        }}
        recipient={recipient}
      />

      <PrivateSendRouteSelector
        provider={provider}
        onProviderChange={(nextProvider) => {
          setProvider(nextProvider);
          setResult(null);
          setError(null);
        }}
      />

      {providerError ? <p className="px-1 text-xs text-destructive">{providerError}</p> : null}
      {insufficientBalance && selectedToken ? (
        <p className="px-1 text-xs text-destructive">
          Insufficient {selectedToken.symbol} balance.
        </p>
      ) : null}
      {selectedToken && amountAtomic && !recipientError && !amountError && !providerError ? (
        <PrivateSendFeeSummary
          error={feePreview.errorMessage}
          isLoading={feePreview.isLoading}
          quote={feePreview.quote}
          solPriceUsd={feePreview.solPriceUsd}
          token={selectedToken}
          tokenPriceUsd={feePreview.tokenPriceUsd}
        />
      ) : null}
      {error ? (
        <p role="alert" className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {result ? <PrivateSendResultBanner result={result} /> : null}

      <Button
        type="submit"
        className="h-14 w-full rounded-[1.5rem] text-base font-semibold"
        loading={step !== "idle" && step !== "success"}
        disabled={!canSubmit}
      >
        {primaryActionLabel}
      </Button>
    </form>
  );
}
