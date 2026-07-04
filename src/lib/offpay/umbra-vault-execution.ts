import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import { address, type Address } from "@solana/kit";
import {
  createSignerFromWalletAccount,
  getPollingComputationMonitor,
  getPollingTransactionForwarder,
  getRpcAccountInfoProvider,
  getRpcBlockhashProvider,
  getRpcEpochInfoProvider,
  getUmbraClient,
  isEncryptedDepositError,
  isEncryptedWithdrawalError,
  isKeyConsistencyError,
  isMasterSeedSigningRejectedError,
  isRegistrationError,
  isTransactionError,
  type IUmbraClient,
} from "@umbra-privacy/sdk";
import { getATAIntoETADirectDepositorFunction } from "@umbra-privacy/sdk/deposit";
import { getEncryptedBalanceQuerierFunction } from "@umbra-privacy/sdk/query";
import { getUserRegistrationFunction } from "@umbra-privacy/sdk/registration";
import type { MasterSeed, U64 } from "@umbra-privacy/sdk/types";
import { getETAIntoATAWithdrawerFunction } from "@umbra-privacy/sdk/withdrawal";

import type { SolanaCluster, UmbraNetwork, UmbraVaultHolding } from "./types";

type VaultAction = "shield" | "unshield";
type SignerArgs = Parameters<typeof createSignerFromWalletAccount>[0];

export type UmbraVaultExecutionInput = {
  action: VaultAction;
  amountAtomic: bigint;
  cluster: SolanaCluster;
  gatewayOrigin: string | undefined;
  holding: UmbraVaultHolding;
  wallet: ConnectedStandardSolanaWallet | undefined;
};

export type UmbraVaultRegistrationInput = {
  cluster: SolanaCluster;
  gatewayOrigin: string | undefined;
  wallet: ConnectedStandardSolanaWallet | undefined;
};

export type UmbraVaultExecutionResult = {
  action: VaultAction;
  signatureLabel: string | null;
};

export type UmbraVaultRegistrationResult = {
  signatureLabel: string | null;
};

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

const masterSeedCache = new Map<string, MasterSeed>();

function clusterToUmbraNetwork(cluster: SolanaCluster): UmbraNetwork {
  if (cluster === "solana:devnet") return "devnet";
  if (cluster === "solana:mainnet") return "mainnet";

  throw new UmbraVaultExecutionError(
    "unsupported_network",
    "Umbra vault is available on devnet and mainnet only.",
  );
}

function gatewayUrl(gatewayOrigin: string | undefined, path: string): string {
  if (!gatewayOrigin) {
    throw new UmbraVaultExecutionError(
      "gateway_missing",
      "Gateway is not configured for Umbra transactions.",
    );
  }

  try {
    return new URL(path, gatewayOrigin).toString();
  } catch (error) {
    throw new UmbraVaultExecutionError(
      "gateway_invalid",
      "Gateway URL is invalid.",
      { cause: error },
    );
  }
}

function findWalletAccount(wallet: ConnectedStandardSolanaWallet): SignerArgs {
  const standardWallet = wallet.standardWallet as SignerArgs["wallet"];
  const account = standardWallet.accounts.find(
    (candidate) => candidate.address === wallet.address,
  ) as SignerArgs["account"] | undefined;

  if (!account) {
    throw new UmbraVaultExecutionError(
      "wallet_account_missing",
      "Connected wallet account is not ready.",
    );
  }

  return { account, wallet: standardWallet };
}

function createClientDeps(rpcUrl: string) {
  return {
    accountInfoProvider: getRpcAccountInfoProvider({ rpcUrl }),
    blockhashProvider: getRpcBlockhashProvider({ rpcUrl }),
    computationMonitor: getPollingComputationMonitor({ rpcUrl }),
    epochInfoProvider: getRpcEpochInfoProvider({ rpcUrl }),
    transactionForwarder: getPollingTransactionForwarder({ rpcUrl }),
  };
}

async function createUmbraClient({
  cluster,
  gatewayOrigin,
  wallet,
}: {
  cluster: SolanaCluster;
  gatewayOrigin: string | undefined;
  wallet: ConnectedStandardSolanaWallet;
}): Promise<IUmbraClient> {
  const network = clusterToUmbraNetwork(cluster);
  const rpcUrl = gatewayUrl(gatewayOrigin, `/web/rpc/${network}`);
  const indexerApiEndpoint = gatewayUrl(gatewayOrigin, `/web/umbra/indexer/${network}`);
  const signer = createSignerFromWalletAccount(findWalletAccount(wallet));
  const deps = createClientDeps(rpcUrl);
  const masterSeedCacheKey = `${network}:${wallet.address}`;

  return getUmbraClient(
    {
      deferMasterSeedSignature: true,
      indexerApiEndpoint,
      network,
      rpcSubscriptionsUrl: rpcUrl,
      rpcUrl,
      signer,
    },
    {
      ...deps,
      masterSeedStorage: {
        load: async () => {
          const seed = masterSeedCache.get(masterSeedCacheKey);
          return seed ? { exists: true as const, seed } : { exists: false as const };
        },
        store: async (seed) => {
          masterSeedCache.set(masterSeedCacheKey, seed);
          return { success: true as const };
        },
      },
    },
  );
}

async function registerConfidentialUser(client: IUmbraClient): Promise<unknown> {
  const register = getUserRegistrationFunction({ client });
  return register({
    anonymous: false,
    confidential: true,
  });
}

async function readEncryptedBalance(client: IUmbraClient, mint: Address): Promise<bigint> {
  const query = getEncryptedBalanceQuerierFunction({ client });
  const balances = await query([mint]);
  const balance = balances.get(mint);

  if (!balance || balance.state === "non_existent" || balance.state === "uninitialized") {
    return 0n;
  }

  if (balance.state === "mxe") {
    throw new UmbraVaultExecutionError(
      "encrypted_balance_pending",
      "Encrypted balance is not readable until Umbra finishes shared-mode setup.",
    );
  }

  return balance.balance;
}

function signatureLabel(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;

  const values = Object.values(result as Record<string, unknown>);
  const signature = values.find(
    (value): value is string => typeof value === "string" && value.length >= 32,
  );

  return signature ? `${signature.slice(0, 4)}...${signature.slice(-4)}` : null;
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

function simulationDiagnostics(error: unknown): { logs: string[]; message: string } | null {
  const chain = collectErrorChain(error);

  for (const item of chain) {
    const record = asRecord(item);
    const logs = readStringArray(
      isTransactionError(item) ? item.simulationLogs : record?.simulationLogs,
    );

    if (!logs) continue;

    const joined = logs.join("\n");
    if (/insufficient lamports|insufficient funds|attempt to debit/i.test(joined)) {
      return {
        logs,
        message: "Insufficient SOL for Umbra setup and network fees.",
      };
    }

    const anchorError = logs.find((line) =>
      /AnchorError|Error Code:|custom program error|Program log: Error/i.test(line),
    );

    return {
      logs,
      message: anchorError
        ? `Umbra simulation failed: ${anchorError.replace(/^Program log:\s*/i, "")}`
        : "Umbra simulation failed. Check the console simulation logs and retry.",
    };
  }

  return null;
}

function toMessage(error: unknown): string {
  const simulation = simulationDiagnostics(error);
  if (simulation) return simulation.message;

  if (error instanceof UmbraVaultExecutionError) return error.message;
  if (isMasterSeedSigningRejectedError(error)) return "Umbra authorization was cancelled.";
  if (isKeyConsistencyError(error)) {
    return "This wallet has a different Umbra key registered. Use the same wallet/session used to create the vault.";
  }
  if (isRegistrationError(error)) {
    return "Umbra vault setup failed. Check wallet approval and retry.";
  }
  if (isEncryptedDepositError(error)) return "Umbra shield transaction failed. Try again.";
  if (isEncryptedWithdrawalError(error)) return "Umbra unshield transaction failed. Try again.";

  const message = error instanceof Error ? error.message : String(error);
  if (/register|unregistered|confidential user/i.test(message)) {
    return "Set up the Umbra vault first, then retry.";
  }
  if (/reject|cancel|declin/i.test(message)) return "Wallet confirmation was cancelled.";
  if (/insufficient|balance|fund/i.test(message)) return "Insufficient balance or SOL for fees.";
  if (/blockhash|timeout|network|fetch|rpc/i.test(message)) {
    return "Network request failed while preparing the Umbra transaction. Retry in a moment.";
  }

  return "Unable to complete the Umbra transaction.";
}

export function umbraVaultExecutionMessage(error: unknown): string {
  return toMessage(error);
}

export async function executeUmbraVaultRegistration({
  cluster,
  gatewayOrigin,
  wallet,
}: UmbraVaultRegistrationInput): Promise<UmbraVaultRegistrationResult> {
  if (!wallet) {
    throw new UmbraVaultExecutionError("wallet_missing", "Connect wallet first.");
  }

  const client = await createUmbraClient({ cluster, gatewayOrigin, wallet });
  const result = await registerConfidentialUser(client);

  return { signatureLabel: signatureLabel(result) };
}

export async function executeUmbraVaultAction({
  action,
  amountAtomic,
  cluster,
  gatewayOrigin,
  holding,
  wallet,
}: UmbraVaultExecutionInput): Promise<UmbraVaultExecutionResult> {
  if (!wallet) {
    throw new UmbraVaultExecutionError("wallet_missing", "Connect wallet first.");
  }

  const client = await createUmbraClient({ cluster, gatewayOrigin, wallet });
  const userAddress = address(wallet.address);
  const mintAddress = address(holding.mint);
  const amount = amountAtomic as U64;

  if (action === "shield") {
    const deposit = getATAIntoETADirectDepositorFunction({ client });
    const result = await deposit(userAddress, mintAddress, amount, {
      accountInfoCommitment: "confirmed",
      epochInfoCommitment: "confirmed",
    });

    return { action, signatureLabel: signatureLabel(result) };
  }

  const encryptedBalance = await readEncryptedBalance(client, mintAddress);
  if (amountAtomic > encryptedBalance) {
    throw new UmbraVaultExecutionError(
      "insufficient_encrypted_balance",
      `Insufficient shielded ${holding.symbol}.`,
    );
  }

  const withdraw = getETAIntoATAWithdrawerFunction({ client });
  const result = await withdraw(userAddress, mintAddress, amount, {
    accountInfoCommitment: "confirmed",
  });

  return { action, signatureLabel: signatureLabel(result) };
}
