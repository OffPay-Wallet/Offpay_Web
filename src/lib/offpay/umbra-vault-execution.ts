import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import { address, type Address } from "@solana/kit";
import {
  getPollingComputationMonitor,
  getRpcAccountInfoProvider,
  getRpcBlockhashProvider,
  getRpcEpochInfoProvider,
  getUmbraClient,
  type IUmbraClient,
} from "@umbra-privacy/sdk";
import { getATAIntoETADirectDepositorFunction } from "@umbra-privacy/sdk/deposit";
import { getEncryptedBalanceQuerierFunction } from "@umbra-privacy/sdk/query";
import { getUserRegistrationFunction } from "@umbra-privacy/sdk/registration";
import type { MasterSeed, U64 } from "@umbra-privacy/sdk/types";
import { getETAIntoATAWithdrawerFunction } from "@umbra-privacy/sdk/withdrawal";

import type { SolanaCluster, UmbraNetwork, UmbraVaultHolding } from "./types";
import { UmbraVaultExecutionError } from "./umbra-vault-errors";
import { createUmbraVaultTransactionForwarder } from "./umbra-vault-forwarder";
import { createUmbraWalletSigner } from "./umbra-wallet-signer";

export { UmbraVaultExecutionError, umbraVaultExecutionMessage } from "./umbra-vault-errors";

type VaultAction = "shield" | "unshield";
type SignerArgs = Parameters<typeof createUmbraWalletSigner>[0];

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

const masterSeedCache = new Map<string, MasterSeed>();
const umbraClientCache = new Map<
  string,
  { client: Promise<IUmbraClient>; wallet: ConnectedStandardSolanaWallet }
>();
const arciumVaultActionDeps = {
  arcium: {
    awaitComputationFinalization: {
      reclaimComputationRent: false,
    },
  },
} as const;

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
    transactionForwarder: createUmbraVaultTransactionForwarder(rpcUrl),
  };
}

function cacheKey({
  gatewayOrigin,
  network,
  walletAddress,
}: {
  gatewayOrigin: string | undefined;
  network: UmbraNetwork;
  walletAddress: string;
}): string {
  return `${network}:${gatewayOrigin ?? ""}:${walletAddress}`;
}

async function buildUmbraClient({
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
  const signer = createUmbraWalletSigner(findWalletAccount(wallet));
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

async function createUmbraClient(input: {
  cluster: SolanaCluster;
  gatewayOrigin: string | undefined;
  wallet: ConnectedStandardSolanaWallet;
}): Promise<IUmbraClient> {
  const network = clusterToUmbraNetwork(input.cluster);
  const key = cacheKey({
    gatewayOrigin: input.gatewayOrigin,
    network,
    walletAddress: input.wallet.address,
  });
  const cached = umbraClientCache.get(key);

  if (cached?.wallet === input.wallet) {
    return cached.client;
  }

  const client = buildUmbraClient(input);
  umbraClientCache.set(key, { client, wallet: input.wallet });
  return client;
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
    const deposit = getATAIntoETADirectDepositorFunction({ client }, arciumVaultActionDeps);
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

  const withdraw = getETAIntoATAWithdrawerFunction({ client }, arciumVaultActionDeps);
  const result = await withdraw(userAddress, mintAddress, amount, {
    accountInfoCommitment: "confirmed",
  });

  return { action, signatureLabel: signatureLabel(result) };
}
