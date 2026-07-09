import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";

import { magicBlockSignatureLabel, type PrivateSendFlowStep } from "./private-send-form-utils";
import type { PrivateSendResult } from "./private-send-route-ui";

import { ensureGatewaySession } from "@/lib/offpay/gateway-session-client";
import { readGatewayUmbraVaultRegistrationStatus } from "@/lib/offpay/gateway-client";
import { requestGatewayMagicBlockPrivateSend } from "@/lib/offpay/private-send-gateway-client";
import type { PrivateSendToken } from "@/lib/offpay/private-send";
import { signSerializedTransactionBase64 } from "@/lib/offpay/solana-transaction-signing";
import type {
  MagicBlockSubmittedPrivateTransfer,
  MagicBlockUnsignedPrivateTransfer,
  SolanaCluster,
  WebWalletCustody,
} from "@/lib/offpay/types";
import { executeUmbraPrivateSend } from "@/lib/offpay/umbra-vault-execution";

type SetStep = (step: PrivateSendFlowStep) => void;

export async function runMagicBlockPrivateSend({
  activeWallet,
  amountAtomic,
  amountLabel,
  cluster,
  draft,
  gatewayOrigin,
  recipient,
  selectedToken,
  setStep,
  walletCustody,
}: {
  activeWallet: ConnectedStandardSolanaWallet | undefined;
  amountAtomic: bigint;
  amountLabel: string;
  cluster: SolanaCluster;
  draft: { prepared: MagicBlockUnsignedPrivateTransfer; sessionToken: string } | null;
  gatewayOrigin: string | undefined;
  recipient: string;
  selectedToken: PrivateSendToken;
  setStep: SetStep;
  walletCustody: WebWalletCustody | undefined;
}): Promise<PrivateSendResult> {
  if (!activeWallet || !gatewayOrigin || !walletCustody) {
    throw new Error("Connect a Solana wallet first.");
  }

  if (amountAtomic > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("MagicBlock supports this token up to the safe integer amount limit.");
  }

  let prepared = draft?.prepared;
  let sessionToken = draft?.sessionToken;

  if (!prepared || !sessionToken) {
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
    });

    if (!preparedEnvelope.ok) throw new Error(preparedEnvelope.error.message);
    prepared = preparedEnvelope.data as MagicBlockUnsignedPrivateTransfer;
    sessionToken = session.sessionToken;
  }

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
    sessionToken,
    transactionBase64: signedTransactionBase64,
    ...(prepared.sendRpcEndpoint ? { sendRpcEndpoint: prepared.sendRpcEndpoint } : {}),
  });

  if (!submittedEnvelope.ok) throw new Error(submittedEnvelope.error.message);

  return {
    amountLabel,
    provider: "magicblock",
    signatureLabel: magicBlockSignatureLabel(
      submittedEnvelope.data as MagicBlockSubmittedPrivateTransfer,
    ),
  };
}

export async function runUmbraRoutePrivateSend({
  activeWallet,
  amountAtomic,
  amountLabel,
  cluster,
  gatewayOrigin,
  recipient,
  selectedToken,
  setStep,
}: {
  activeWallet: ConnectedStandardSolanaWallet | undefined;
  amountAtomic: bigint;
  amountLabel: string;
  cluster: SolanaCluster;
  gatewayOrigin: string | undefined;
  recipient: string;
  selectedToken: PrivateSendToken;
  setStep: SetStep;
}): Promise<PrivateSendResult> {
  if (!gatewayOrigin) throw new Error("Gateway origin is not configured.");

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

  return {
    amountLabel,
    provider: "umbra",
    signatureLabel: sent.signatureLabel,
  };
}
