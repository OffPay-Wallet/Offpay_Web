import {
  isEncryptedDepositError,
  isEncryptedWithdrawalError,
  isKeyConsistencyError,
  isMasterSeedSigningRejectedError,
  isRegistrationError,
  isTransactionError,
} from "@umbra-privacy/sdk";

export class UmbraVaultExecutionError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "UmbraVaultExecutionError";
    this.code = code;

    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function collectErrorChain(error: unknown): unknown[] {
  const seen = new Set<unknown>();
  const stack = [error];
  const chain: unknown[] = [];

  while (stack.length > 0) {
    const current = stack.shift();
    if (!current || seen.has(current)) continue;

    seen.add(current);
    chain.push(current);

    const record = asRecord(current);
    if (record?.cause) stack.push(record.cause);
    if (record?.error) stack.push(record.error);
  }

  return chain;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const lines = value.filter((line): line is string => typeof line === "string");
  return lines.length > 0 ? lines : null;
}

function stringifyDiagnostic(value: unknown): string {
  if (value == null) return "";

  try {
    return JSON.stringify(value, (_, nested) =>
      typeof nested === "bigint" ? nested.toString() : nested,
    );
  } catch {
    return String(value);
  }
}

function readSimulationErr(record: Record<string, unknown> | null): string | null {
  if (!record || record.simulationErr == null) return null;

  const value = stringifyDiagnostic(record.simulationErr).trim();
  return value.length > 0 ? value : null;
}

function cleanProgramLog(line: string): string {
  return line.replace(/^Program log:\s*/i, "").trim();
}

function simulationMessageFromText(text: string): string | null {
  if (/insufficient lamports|insufficient funds for fee|attempt to debit/i.test(text)) {
    return "Insufficient SOL for Umbra setup and network fees.";
  }

  if (/insufficient token|token.*insufficient|custom program error: 0x1/i.test(text)) {
    return "Insufficient token balance for this Umbra shield amount.";
  }

  if (/accountnotinitialized|account not initialized|could not find account|not found/i.test(text)) {
    return "Required Umbra or token account is not initialized. Refresh the vault and try setup again.";
  }

  if (/ownermismatch|owner does not match|incorrect owner|accountownedbywrongprogram/i.test(text)) {
    return "Token account ownership does not match this wallet or mint. Refresh balances before retrying.";
  }

  if (/computationalbudgetexceeded|programfailedtocomplete|max instructions|exceeded.*compute/i.test(text)) {
    return "Umbra transaction exceeded the compute budget. Retry with a smaller amount.";
  }

  if (/signaturefailure|signature verification failure/i.test(text)) {
    return "Wallet returned an invalid Umbra transaction signature. Reconnect the wallet and try again.";
  }

  if (/blockhashnotfound|blockhash not found/i.test(text)) {
    return "Wallet confirmation took too long or the signed transaction expired. Rebuild and sign again.";
  }

  return null;
}

function simulationDiagnostics(error: unknown): { logs: string[]; message: string } | null {
  const chain = collectErrorChain(error);

  for (const item of chain) {
    const record = asRecord(item);
    const logs = readStringArray(
      isTransactionError(item) ? item.simulationLogs : record?.simulationLogs,
    );
    const errText = readSimulationErr(record);
    const joined = [logs?.join("\n"), errText].filter(Boolean).join("\n");

    if (!joined) continue;

    const classified = simulationMessageFromText(joined);
    if (classified) return { logs: logs ?? [], message: classified };

    const anchorError = logs?.find((line) =>
      /AnchorError|Error Code:|custom program error|Program log: Error/i.test(line),
    );

    if (anchorError) {
      return {
        logs: logs ?? [],
        message: `Umbra simulation failed: ${cleanProgramLog(anchorError)}`,
      };
    }

    if (errText) {
      return {
        logs: logs ?? [],
        message: `Umbra simulation failed: ${errText.slice(0, 180)}`,
      };
    }

    return {
      logs: logs ?? [],
      message: "Umbra simulation failed. Check the console simulation logs and retry.",
    };
  }

  return null;
}

function directKnownMessage(error: unknown): string | null {
  if (error instanceof UmbraVaultExecutionError) return error.message;
  if (isMasterSeedSigningRejectedError(error)) return "Umbra authorization was cancelled.";
  if (isKeyConsistencyError(error)) {
    return "This wallet has a different Umbra key registered. Use the same wallet/session used to create the vault.";
  }
  if (isRegistrationError(error)) {
    return "Umbra vault setup failed. Check wallet approval and retry.";
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/wallet did not attach.*umbra transaction signature/i.test(message)) {
    return "Wallet approved but did not return a valid Umbra transaction signature. Reconnect the wallet and try again.";
  }
  if (/wallet.*modified.*umbra transaction message/i.test(message)) {
    return "Wallet changed the Umbra transaction before signing. Reconnect the wallet and try again.";
  }
  if (
    /rpc__transport_http_error|rpc_method_not_allowed|rpc_invalid_request|statuscode["']?:400|bad request/i.test(
      message,
    )
  ) {
    return "Gateway RPC rejected the Umbra transaction request. Retry after the gateway update is deployed.";
  }
  if (/fee payer signature missing|signatures?_missing|signature.*missing/i.test(message)) {
    return "Wallet did not return every signature needed for this Umbra transaction.";
  }
  if (/register|unregistered|confidential user/i.test(message)) {
    return "Set up the Umbra vault first, then retry.";
  }
  if (/reject|cancel|declin/i.test(message)) return "Wallet confirmation was cancelled.";
  if (/insufficient|balance|fund/i.test(message)) return "Insufficient balance or SOL for fees.";
  if (/blockhash|timeout|network|fetch|rpc|failed to fetch/i.test(message)) {
    return "Network request failed while preparing the Umbra transaction. Retry in a moment.";
  }

  return null;
}

function nestedKnownMessage(error: unknown): string | null {
  const [, ...causes] = collectErrorChain(error);

  for (const cause of causes) {
    const simulation = simulationDiagnostics(cause);
    if (simulation) return simulation.message;

    const direct = directKnownMessage(cause);
    if (direct) return direct;
  }

  return null;
}

function toMessage(error: unknown): string {
  const simulation = simulationDiagnostics(error);
  if (simulation) return simulation.message;

  const direct = directKnownMessage(error);
  if (direct) return direct;

  const nested = nestedKnownMessage(error);
  if (nested) return nested;

  if (isEncryptedDepositError(error)) return "Umbra shield transaction failed. Try again.";
  if (isEncryptedWithdrawalError(error)) return "Umbra unshield transaction failed. Try again.";

  return "Unable to complete the Umbra transaction.";
}

export function umbraVaultExecutionMessage(error: unknown): string {
  return toMessage(error);
}
