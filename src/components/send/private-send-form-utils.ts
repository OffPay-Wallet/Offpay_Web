import { truncateAddress } from "@/lib/offpay/display";
import type { MagicBlockSubmittedPrivateTransfer } from "@/lib/offpay/types";

export const privateSendFieldClassName =
  "h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

export type PrivateSendFlowStep = "idle" | "session" | "prepare" | "sign" | "submit" | "success";

export function privateSendFieldErrorId(field: string) {
  return `private-send-${field}-error`;
}

export function magicBlockSignatureLabel(result: MagicBlockSubmittedPrivateTransfer): string {
  return truncateAddress(result.signature, 6);
}

export function privateSendSubmitLabel(step: string): string {
  if (step === "session") return "Authorizing";
  if (step === "prepare") return "Preparing";
  if (step === "sign") return "Check wallet";
  if (step === "submit") return "Submitting";
  return "Send privately";
}

export function privateSendPrimaryLabel({
  amount,
  amountError,
  authenticated,
  feeLoading,
  insufficientBalance,
  providerError,
  recipientError,
  selectedToken,
  step,
}: {
  amount: string;
  amountError: string | null;
  authenticated: boolean;
  feeLoading: boolean;
  insufficientBalance: boolean;
  providerError: string | null;
  recipientError: string | null;
  selectedToken: { symbol: string } | null;
  step: PrivateSendFlowStep;
}): string {
  if (step !== "idle" && step !== "success") return privateSendSubmitLabel(step);
  if (!authenticated) return "Connect Wallet";
  if (!amount.trim()) return "Enter the Amount";
  if (amountError) return "Check the Amount";
  if (recipientError) return "Enter Receiver";
  if (providerError) return "Choose Another Route";
  if (insufficientBalance) {
    return selectedToken ? `Insufficient ${selectedToken.symbol}` : "Insufficient Balance";
  }
  if (feeLoading) return "Reviewing Fees";
  return "Send Privately";
}
