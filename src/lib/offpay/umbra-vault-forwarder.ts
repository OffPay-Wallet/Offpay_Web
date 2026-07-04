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

type ForwardSequentiallyWithOptions = (
  transactions: readonly SignedTransaction[],
  options?: PollingForwardOptions,
) => Promise<readonly TransactionSignature[]>;

type ForwardInParallelWithOptions = (
  transactions: readonly SignedTransaction[],
  options?: PollingForwardOptions,
) => Promise<readonly TransactionSignature[]>;

type SimulationValue = {
  readonly err?: unknown;
  readonly logs?: readonly string[] | null;
};

const confirmedCommitments = ["confirmed", "finalized"];

function readSimulationValue(response: unknown): SimulationValue | null {
  const record = response && typeof response === "object" ? response as Record<string, unknown> : null;
  const value = record?.value;

  return value && typeof value === "object" ? value as SimulationValue : null;
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

async function assertSimulationPasses(
  rpc: ReturnType<typeof createSolanaRpc>,
  transaction: SignedTransaction,
  commitment: Commitment,
) {
  const wireTransaction = getBase64EncodedWireTransaction(transaction);
  const response = await rpc
    .simulateTransaction(wireTransaction, {
      commitment,
      encoding: "base64",
      replaceRecentBlockhash: false,
      sigVerify: true,
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

async function sendWithoutDuplicatePreflight(
  rpc: ReturnType<typeof createSolanaRpc>,
  transaction: SignedTransaction,
): Promise<TransactionSignature> {
  const wireTransaction = getBase64EncodedWireTransaction(transaction);
  const signature = await rpc
    .sendTransaction(wireTransaction, {
      encoding: "base64",
      skipPreflight: true,
    })
    .send();

  return signature as TransactionSignature;
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
      await assertSimulationPasses(rpc, transaction, "confirmed");
      return sendWithoutDuplicatePreflight(rpc, transaction);
    },
    forwardInParallel: async (transactions, options?: PollingForwardOptions) => {
      const commitment = options?.commitment ?? "confirmed";
      const timeoutMs = options?.timeoutMs ?? 60_000;
      const pollingIntervalMs = options?.pollingIntervalMs ?? 1_000;

      await Promise.all(
        transactions.map((transaction) => assertSimulationPasses(rpc, transaction, commitment)),
      );

      const signatures = await Promise.all(
        transactions.map((transaction) => sendWithoutDuplicatePreflight(rpc, transaction)),
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
        await assertSimulationPasses(rpc, transaction, commitment);
        const signature = await sendWithoutDuplicatePreflight(rpc, transaction);
        await waitForConfirmation({ commitment, pollingIntervalMs, rpc, signature, timeoutMs });
        signatures.push(signature);
        await options?.onTransactionConfirmed?.({ index, signature, totalCount });
      }

      return signatures;
    },
  };
}
