import {
  createSolanaRpc,
  getBase64EncodedWireTransaction,
  signature as solanaSignature,
  type Commitment,
} from "@solana/kit";
import {
  type SignedTransaction,
  type TransactionForwarder,
  type TransactionSignature,
} from "@umbra-privacy/sdk";

import { UmbraVaultExecutionError } from "./umbra-vault-errors";

type TransactionConfirmedInfo = {
  readonly index: number;
  readonly signature: TransactionSignature;
  readonly totalCount: number;
};

type PollingForwardOptions = {
  readonly commitment?: Commitment;
  readonly maxRetries?: number;
  readonly onTransactionConfirmed?: (info: TransactionConfirmedInfo) => Promise<void>;
  readonly pollingIntervalMs?: number;
  readonly timeoutMs?: number;
};

type SimulationValue = {
  readonly err?: unknown;
  readonly logs?: readonly string[] | null;
};

const confirmedCommitments = ["confirmed", "finalized"];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function readSimulationValue(response: unknown): SimulationValue | null {
  const record = asRecord(response);
  const value = record?.value;

  return value && typeof value === "object" ? value as SimulationValue : null;
}

function findSimulationValue(value: unknown, seen = new Set<unknown>()): SimulationValue | null {
  if (!value || seen.has(value)) return null;
  seen.add(value);

  const record = asRecord(value);
  if (!record) return null;

  if ("err" in record || "logs" in record) {
    return {
      err: record.err,
      logs: Array.isArray(record.logs) ? record.logs : null,
    };
  }

  for (const key of ["value", "data", "cause", "error", "context"]) {
    const nested = findSimulationValue(record[key], seen);
    if (nested) return nested;
  }

  return null;
}

function readSimulationLogs(value: SimulationValue | null): string[] {
  if (!Array.isArray(value?.logs)) return [];

  return value.logs.filter((line): line is string => typeof line === "string");
}

function logSimulationFailure(value: SimulationValue | null) {
  const logs = readSimulationLogs(value);
  const err = value?.err;

  try {
    console.error("[offpay-web] umbra.simulation.failed", {
      err,
      logs,
    });
  } catch {
    // Console diagnostics must never prevent error propagation to the UI.
  }
}

function buildSimulationError(value: SimulationValue | null): UmbraVaultExecutionError {
  const logs = readSimulationLogs(value);

  return new UmbraVaultExecutionError(
    "simulation_failed",
    "Umbra transaction simulation failed.",
    {
      cause: {
        simulationErr: value?.err,
        simulationLogs: logs,
      },
    },
  );
}

async function assertProgramSimulationPasses(
  rpc: ReturnType<typeof createSolanaRpc>,
  transaction: SignedTransaction,
  commitment: Commitment,
) {
  const wireTransaction = getBase64EncodedWireTransaction(transaction);
  const response = await rpc
    .simulateTransaction(wireTransaction, {
      commitment,
      encoding: "base64",
      replaceRecentBlockhash: true,
      sigVerify: false,
    })
    .send();
  const value = readSimulationValue(response);

  if (value?.err) {
    logSimulationFailure(value);
    throw buildSimulationError(value);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function stringifyRpcValue(value: unknown): string {
  try {
    return JSON.stringify(value, (_, nested) =>
      typeof nested === "bigint" ? nested.toString() : nested,
    );
  } catch {
    return String(value);
  }
}

async function sendWithRpcPreflight(
  rpc: ReturnType<typeof createSolanaRpc>,
  transaction: SignedTransaction,
  commitment: Commitment,
): Promise<TransactionSignature> {
  const wireTransaction = getBase64EncodedWireTransaction(transaction);
  try {
    const signature = await rpc
      .sendTransaction(wireTransaction, {
        encoding: "base64",
        maxRetries: 0n,
        preflightCommitment: commitment,
      })
      .send();

    return signature as unknown as TransactionSignature;
  } catch (error) {
    const value = findSimulationValue(error) ?? signatureFailureSimulationValue(error);
    if (value) {
      logSimulationFailure(value);
      throw buildSimulationError(value);
    }

    throw error;
  }
}

function signatureFailureSimulationValue(error: unknown): SimulationValue | null {
  const text = stringifyRpcValue(error);
  if (!/signaturefailure|signature verification failure/i.test(text)) return null;

  return {
    err: "SignatureFailure",
    logs: null,
  };
}

function commitmentReached(
  actual: string | null | undefined,
  requested: Commitment,
): boolean {
  if (requested === "processed") return actual != null;
  if (requested === "confirmed") return actual != null && confirmedCommitments.includes(actual);
  return actual === "finalized";
}

async function waitForConfirmation({
  commitment,
  pollingIntervalMs,
  rpc,
  signature,
  timeoutMs,
}: {
  commitment: Commitment;
  pollingIntervalMs: number;
  rpc: ReturnType<typeof createSolanaRpc>;
  signature: TransactionSignature;
  timeoutMs: number;
}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await rpc
      .getSignatureStatuses([solanaSignature(signature)], {
        searchTransactionHistory: false,
      })
      .send();
    const status = response.value[0];

    if (status?.err) {
      throw new UmbraVaultExecutionError(
        "transaction_failed",
        `Umbra transaction failed: ${stringifyRpcValue(status.err)}`,
        { cause: { simulationErr: status.err } },
      );
    }

    if (commitmentReached(status?.confirmationStatus, commitment)) return;
    await sleep(pollingIntervalMs);
  }

  throw new UmbraVaultExecutionError(
    "confirmation_timeout",
    "Umbra transaction was submitted but did not confirm in time.",
  );
}

export function createUmbraVaultTransactionForwarder(rpcUrl: string): TransactionForwarder {
  const rpc = createSolanaRpc(rpcUrl);

  return {
    fireAndForget: async (transaction) => {
      await assertProgramSimulationPasses(rpc, transaction, "confirmed");
      return sendWithRpcPreflight(rpc, transaction, "confirmed");
    },
    forwardInParallel: async (transactions, options?: PollingForwardOptions) => {
      const commitment = options?.commitment ?? "confirmed";
      const timeoutMs = options?.timeoutMs ?? 60_000;
      const pollingIntervalMs = options?.pollingIntervalMs ?? 1_000;

      await Promise.all(
        transactions.map((transaction) => assertProgramSimulationPasses(rpc, transaction, commitment)),
      );

      const signatures = await Promise.all(
        transactions.map((transaction) => sendWithRpcPreflight(rpc, transaction, commitment)),
      );
      await Promise.all(
        signatures.map((signature) =>
          waitForConfirmation({ commitment, pollingIntervalMs, rpc, signature, timeoutMs }),
        ),
      );

      return signatures;
    },
    forwardSequentially: async (transactions, options?: PollingForwardOptions) => {
      const commitment = options?.commitment ?? "confirmed";
      const timeoutMs = options?.timeoutMs ?? 60_000;
      const pollingIntervalMs = options?.pollingIntervalMs ?? 1_000;
      const signatures: TransactionSignature[] = [];
      const totalCount = transactions.length;

      for (const [index, transaction] of transactions.entries()) {
        await assertProgramSimulationPasses(rpc, transaction, commitment);
        const signature = await sendWithRpcPreflight(rpc, transaction, commitment);
        await waitForConfirmation({ commitment, pollingIntervalMs, rpc, signature, timeoutMs });
        signatures.push(signature);
        await options?.onTransactionConfirmed?.({ index, signature, totalCount });
      }

      return signatures;
    },
  };
}
