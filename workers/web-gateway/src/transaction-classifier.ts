import type {
  SolanaCluster,
  WalletTransactionSummary,
} from "../../../src/lib/offpay/types";
import { readRecord, readString } from "./token-metadata";
import {
  collectInstructions,
  readAccountKeyAt,
  readInteger,
  type TransactionAssetCandidate,
} from "./transaction-parser";

const umbraProgramIds: Partial<Record<SolanaCluster, string>> = {
  "solana:devnet": "DSuKkyqGVGgo4QtPABfxKJKygUDACbUhirnuv63mEpAJ",
  "solana:mainnet": "UMBRAD2ishebJTcgCLkTkNUx1v3GyoAgpTRPeWoLykh",
};

function transactionText(transaction: Record<string, unknown>, memo: string | null): string {
  const instructionText = collectInstructions(transaction)
    .map((instruction) => JSON.stringify(instruction))
    .join(" ");

  return `${memo ?? ""} ${instructionText}`.toLowerCase();
}

function readUmbraHint(text: string): "shielded" | "unshielded" | null {
  const compact = text.replace(/[^a-z0-9]+/g, "");

  if (
    text.includes("encrypted_balance_to_public") ||
    text.includes("private_to_public") ||
    text.includes("eta_into_ata") ||
    text.includes("withdraw") ||
    text.includes("unshield") ||
    compact.includes("encryptedbalancetopublic") ||
    compact.includes("etaintoata")
  ) {
    return "unshielded";
  }

  if (
    text.includes("public_balance_to_encrypted") ||
    text.includes("public_to_private") ||
    text.includes("ata_into_eta") ||
    text.includes("deposit") ||
    text.includes("shield") ||
    compact.includes("publicbalancetoencrypted") ||
    compact.includes("ataintoeta")
  ) {
    return "shielded";
  }

  return null;
}

function touchesUmbra(
  transaction: Record<string, unknown>,
  cluster: SolanaCluster,
  text: string,
): boolean {
  const programId = umbraProgramIds[cluster];
  if (!programId) return false;
  if (text.includes(programId.toLowerCase())) return true;

  return collectInstructions(transaction).some((instruction) => {
    const directProgramId = readString(instruction.programId);
    if (directProgramId === programId) return true;

    const parsed = readRecord(instruction.parsed);
    const parsedProgramId = readString(parsed?.programId);
    if (parsedProgramId === programId) return true;

    const programIdIndex = readInteger(instruction.programIdIndex);
    return programIdIndex != null && readAccountKeyAt(transaction, programIdIndex) === programId;
  });
}

export function classifyTransaction({
  assets,
  cluster,
  failed,
  memo,
  transaction,
}: {
  assets: readonly TransactionAssetCandidate[];
  cluster: SolanaCluster;
  failed: boolean;
  memo: string | null;
  transaction: Record<string, unknown>;
}): WalletTransactionSummary {
  if (failed) return { kind: "failed", label: "Failed", tone: "failed" };

  const text = transactionText(transaction, memo);
  const umbra = touchesUmbra(transaction, cluster, text);
  const umbraHint = umbra ? readUmbraHint(text) : null;
  const signedDeltas = assets.flatMap((asset) => {
    if (asset.rawAmountChange == null) return [];
    const delta = BigInt(asset.rawAmountChange);
    return delta === 0n ? [] : [delta];
  });
  const hasPositive = signedDeltas.some((delta) => delta > 0n);
  const hasNegative = signedDeltas.some((delta) => delta < 0n);

  if (umbraHint === "shielded" || (umbra && hasNegative && !hasPositive)) {
    return { kind: "shielded", label: "Shielded", tone: "negative" };
  }

  if (umbraHint === "unshielded" || (umbra && hasPositive && !hasNegative)) {
    return { kind: "unshielded", label: "Unshielded", tone: "positive" };
  }

  if (hasPositive && hasNegative) {
    return { kind: "swapped", label: "Swapped", tone: "neutral" };
  }

  if (hasNegative) return { kind: "sent", label: "Sent", tone: "negative" };
  if (hasPositive) return { kind: "received", label: "Received", tone: "positive" };

  return { kind: "unknown", label: umbra ? "Umbra activity" : "Activity", tone: "neutral" };
}
