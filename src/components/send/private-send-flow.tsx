"use client";

import { useQuery } from "@tanstack/react-query";
import { LockKeyhole } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { SectionCard } from "@/components/offpay/section-card";
import {
  PrivateSendResultBanner,
  PrivateSendRouteBoundary,
  PrivateSendRouteSelector,
  type PrivateSendResult,
} from "@/components/send/private-send-route-ui";
import { Button } from "@/components/ui/button";
import { useSolanaWalletAccount } from "@/hooks/use-solana-wallet-account";
import { getErrorMessage, truncateAddress } from "@/lib/offpay/display";
import { ensureGatewaySession } from "@/lib/offpay/gateway-session-client";
import {
  readGatewayUmbraVaultHoldings,
  readGatewayUmbraVaultRegistrationStatus,
} from "@/lib/offpay/gateway-client";
import { requestGatewayMagicBlockPrivateSend } from "@/lib/offpay/private-send-gateway-client";
import {
  formatAtomicTokenAmount,
  parseTokenAmountToAtomic,
  privateSendTokensForCluster,
  type PrivateSendProvider,
  validateSolanaAddress,
} from "@/lib/offpay/private-send";
import { getGatewayOrigin, getPublicSolanaCluster } from "@/lib/offpay/public-config";
import { signSerializedTransactionBase64 } from "@/lib/offpay/solana-transaction-signing";
import type {
  MagicBlockSubmittedPrivateTransfer,
  MagicBlockUnsignedPrivateTransfer,
} from "@/lib/offpay/types";
import {
  executeUmbraPrivateSend,
  umbraVaultExecutionMessage,
} from "@/lib/offpay/umbra-vault-execution";

type FlowStep = "idle" | "session" | "prepare" | "sign" | "submit" | "success";

const fieldClassName =
  "h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

function fieldErrorId(field: string) {
  return `private-send-${field}-error`;
}

function magicBlockSignatureLabel(result: MagicBlockSubmittedPrivateTransfer): string {
  return truncateAddress(result.signature, 6);
}

export function PrivateSendFlow() {
  const {
    activeWallet,
    authenticated,
    walletAddress,
    walletCustody,
    walletsReady,
  } = useSolanaWalletAccount();
  const cluster = getPublicSolanaCluster();
  const gatewayOrigin = getGatewayOrigin();
  const tokens = privateSendTokensForCluster(cluster);
  const [provider, setProvider] = useState<PrivateSendProvider>("magicblock");
  const [recipient, setRecipient] = useState("");
  const [mint, setMint] = useState(tokens[0]?.mint ?? "");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [step, setStep] = useState<FlowStep>("idle");
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
  const parsedAmount =
    selectedToken == null
      ? { error: "Select a supported token." }
      : parseTokenAmountToAtomic(amount, selectedToken.decimals);
  const recipientError = validateSolanaAddress(recipient);
  const amountError = "error" in parsedAmount ? parsedAmount.error : null;
  const providerError =
    provider === "umbra" &&
    selectedToken &&
    umbraHoldingsQuery.isSuccess &&
    !umbraSupportedMints.has(selectedToken.mint)
      ? `${selectedToken.symbol} is not available through Umbra on this network.`
      : null;
  const canSubmit = Boolean(
    authenticated &&
      activeWallet &&
      gatewayOrigin &&
      walletCustody &&
      selectedToken &&
      !recipientError &&
      !amountError &&
      !providerError &&
      step !== "session" &&
      step !== "prepare" &&
      step !== "sign" &&
      step !== "submit",
  );

  async function runMagicBlockSend(amountAtomic: bigint, amountLabel: string) {
    if (!activeWallet || !gatewayOrigin || !walletCustody || !selectedToken) return;

    if (amountAtomic > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("MagicBlock supports this token up to the safe integer amount limit.");
    }

    setStep("session");
    const session = await ensureGatewaySession({
      cluster,
      gatewayOrigin,
      wallet: activeWallet,
      walletCustody,
    });

    setStep("prepare");
    const preparedEnvelope = await requestGatewayMagicBlockPrivateSend(gatewayOrigin, {
      action: "prepare",
      amountAtomic: amountAtomic.toString(),
      mint: selectedToken.mint,
      provider: "magicblock",
      recipient: recipient.trim(),
      sessionToken: session.sessionToken,
      ...(memo.trim() ? { memo: memo.trim() } : {}),
    });

    if (!preparedEnvelope.ok) throw new Error(preparedEnvelope.error.message);
    const prepared = preparedEnvelope.data as MagicBlockUnsignedPrivateTransfer;

    setStep("sign");
    const signedTransactionBase64 = await signSerializedTransactionBase64({
      transactionBase64: prepared.transactionBase64,
      wallet: activeWallet,
    });

    setStep("submit");
    const submittedEnvelope = await requestGatewayMagicBlockPrivateSend(gatewayOrigin, {
      action: "submit",
      lastValidBlockHeight: prepared.lastValidBlockHeight,
      provider: "magicblock",
      recentBlockhash: prepared.recentBlockhash,
      sendTo: prepared.sendTo,
      sessionToken: session.sessionToken,
      transactionBase64: signedTransactionBase64,
      ...(prepared.sendRpcEndpoint ? { sendRpcEndpoint: prepared.sendRpcEndpoint } : {}),
    });

    if (!submittedEnvelope.ok) throw new Error(submittedEnvelope.error.message);

    setResult({
      amountLabel,
      provider,
      signatureLabel: magicBlockSignatureLabel(
        submittedEnvelope.data as MagicBlockSubmittedPrivateTransfer,
      ),
    });
  }

  async function runUmbraSend(amountAtomic: bigint, amountLabel: string) {
    if (!gatewayOrigin || !selectedToken) return;

    setStep("prepare");
    const registration = await readGatewayUmbraVaultRegistrationStatus(gatewayOrigin, {
      network: cluster,
      walletAddress: recipient.trim(),
    });

    if (!registration.ok) throw new Error(registration.error.message);
    if (!registration.data.registered) {
      throw new Error("Recipient needs Umbra setup before receiving this route.");
    }

    setStep("sign");
    const sent = await executeUmbraPrivateSend({
      amountAtomic,
      cluster,
      gatewayOrigin,
      mint: selectedToken.mint,
      recipientAddress: recipient.trim(),
      wallet: activeWallet,
    });

    setResult({
      amountLabel,
      provider,
      signatureLabel: sent.signatureLabel,
    });
  }

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

    const amountAtomic = "amountAtomic" in parsedAmount ? parsedAmount.amountAtomic : 0n;
    const amountLabel = `${formatAtomicTokenAmount(amountAtomic, selectedToken.decimals)} ${
      selectedToken.symbol
    }`;

    try {
      if (provider === "magicblock") {
        await runMagicBlockSend(amountAtomic, amountLabel);
      } else {
        await runUmbraSend(amountAtomic, amountLabel);
      }
      setStep("success");
    } catch (caught) {
      setStep("idle");
      setError(provider === "umbra" ? umbraVaultExecutionMessage(caught) : getErrorMessage(caught));
    }
  }

  return (
    <form onSubmit={submitPrivateSend} className="space-y-5">
      <SectionCard
        title="Private send"
        icon={<LockKeyhole className="h-5 w-5" aria-hidden="true" />}
      >
        <PrivateSendRouteSelector
          provider={provider}
          onProviderChange={(nextProvider) => {
            setProvider(nextProvider);
            setResult(null);
            setError(null);
          }}
        />

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium" htmlFor="private-send-recipient">
            Recipient
            <input
              id="private-send-recipient"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              className={fieldClassName}
              autoComplete="off"
              spellCheck={false}
              placeholder="Solana address"
              aria-invalid={attempted && recipientError ? "true" : undefined}
              aria-describedby={
                attempted && recipientError ? fieldErrorId("recipient") : undefined
              }
            />
          </label>
          {attempted && recipientError ? (
            <p id={fieldErrorId("recipient")} className="text-xs text-destructive">
              {recipientError}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium" htmlFor="private-send-asset">
              Asset
              <select
                id="private-send-asset"
                value={mint}
                onChange={(event) => setMint(event.target.value)}
                className={fieldClassName}
                disabled={tokens.length === 0}
              >
                {tokens.map((token) => (
                  <option key={token.mint} value={token.mint}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium" htmlFor="private-send-amount">
              Amount
              <input
                id="private-send-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className={fieldClassName}
                autoComplete="off"
                inputMode="decimal"
                placeholder="0.00"
                spellCheck={false}
                aria-invalid={attempted && amountError ? "true" : undefined}
                aria-describedby={attempted && amountError ? fieldErrorId("amount") : undefined}
              />
            </label>
          </div>
          {attempted && amountError ? (
            <p id={fieldErrorId("amount")} className="text-xs text-destructive">
              {amountError}
            </p>
          ) : null}

          {provider === "magicblock" ? (
            <label className="grid gap-2 text-sm font-medium" htmlFor="private-send-memo">
              Memo
              <input
                id="private-send-memo"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                className={fieldClassName}
                autoComplete="off"
                maxLength={80}
                placeholder="Optional"
                spellCheck={false}
              />
            </label>
          ) : null}

          {providerError ? <p className="text-xs text-destructive">{providerError}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {result ? <PrivateSendResultBanner result={result} /> : null}
        </div>

        <Button type="submit" className="mt-5 w-full" loading={step !== "idle" && step !== "success"} disabled={!canSubmit}>
          {step === "session"
            ? "Authorizing"
            : step === "prepare"
              ? "Preparing"
              : step === "sign"
                ? "Check wallet"
                : step === "submit"
                  ? "Submitting"
                  : "Send privately"}
        </Button>
      </SectionCard>

      <PrivateSendRouteBoundary
        cluster={cluster}
        provider={provider}
        walletAddress={walletAddress ?? null}
        walletsReady={walletsReady}
      />
    </form>
  );
}
