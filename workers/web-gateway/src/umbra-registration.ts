import type {
  SolanaCluster,
  UmbraNetwork,
  UmbraVaultRegistrationStatus,
} from "../../../src/lib/offpay/types";
import { address, type Address } from "@solana/kit";
import type { IUmbraClient } from "@umbra-privacy/sdk";
import { getNetworkConfig } from "@umbra-privacy/sdk/constants";
import {
  getUserAccountQuerierFunction,
  type QueryUserAccountResult,
} from "@umbra-privacy/sdk/query";
import { getRpcAccountInfoProvider } from "@umbra-privacy/sdk/solana";

import { rpcProviderConfig } from "./rpc-core";
import type { GatewayEnv } from "./types";
import { readUmbraGatewayStatus } from "./umbra-status";
import { UmbraVaultGatewayError } from "./umbra-vault";

type UmbraRegistrationIdentity = {
  address: string;
  cluster: SolanaCluster;
};

export type QueryUmbraUserAccount = (
  userAddress: Address,
  options?: { accountInfoCommitment?: "processed" | "confirmed" | "finalized" },
) => Promise<QueryUserAccountResult>;

function readUmbraRpcUrl(env: GatewayEnv, cluster: SolanaCluster): string | null {
  return rpcProviderConfig(env, cluster).urls[0] ?? null;
}

function createUserAccountQuery({
  network,
  rpcUrl,
}: {
  network: UmbraNetwork;
  rpcUrl: string;
}): QueryUmbraUserAccount {
  const client = {
    accountInfoProvider: getRpcAccountInfoProvider({ rpcUrl }),
    networkConfig: getNetworkConfig(network),
  } as IUmbraClient;

  return getUserAccountQuerierFunction({ client });
}

function mapRegistrationStatus({
  identity,
  network,
  result,
}: {
  identity: UmbraRegistrationIdentity;
  network: UmbraNetwork;
  result: QueryUserAccountResult;
}): UmbraVaultRegistrationStatus {
  const userAccountExists = result.state === "exists";
  const x25519Registered = userAccountExists
    ? result.data.isUserAccountX25519KeyRegistered
    : false;
  const registered = userAccountExists && x25519Registered;

  return {
    address: identity.address,
    cluster: identity.cluster as Exclude<SolanaCluster, "solana:testnet">,
    fetchedAt: new Date().toISOString(),
    network,
    registered,
    state: registered
      ? "registered"
      : userAccountExists
        ? "needs_setup"
        : "not_registered",
    userAccountExists,
    x25519Registered,
  };
}

export async function readUmbraVaultRegistrationStatus({
  env,
  identity,
  queryUserAccount,
}: {
  env: GatewayEnv;
  identity: UmbraRegistrationIdentity;
  queryUserAccount?: QueryUmbraUserAccount;
}): Promise<UmbraVaultRegistrationStatus> {
  const status = readUmbraGatewayStatus(env, identity.cluster);

  if (!status.supported || !status.network) {
    throw new UmbraVaultGatewayError({
      code: "umbra_cluster_unsupported",
      message: "Umbra vault registration is available on devnet and mainnet.",
      status: 400,
    });
  }

  const rpcUrl = readUmbraRpcUrl(env, identity.cluster);

  if (!rpcUrl && !queryUserAccount) {
    const { expectedKeys } = rpcProviderConfig(env, identity.cluster);

    throw new UmbraVaultGatewayError({
      code: "umbra_rpc_missing",
      details: { expectedKeys },
      message: "Solana RPC is not configured for Umbra registration checks.",
      status: 503,
    });
  }

  try {
    const query =
      queryUserAccount ??
      createUserAccountQuery({
        network: status.network,
        rpcUrl: rpcUrl as string,
      });
    const result = await query(address(identity.address), {
      accountInfoCommitment: "confirmed",
    });

    return mapRegistrationStatus({
      identity,
      network: status.network,
      result,
    });
  } catch (error) {
    if (error instanceof UmbraVaultGatewayError) throw error;

    throw new UmbraVaultGatewayError({
      code: "umbra_registration_status_unavailable",
      message: "Unable to verify Umbra vault registration.",
      status: 502,
    });
  }
}
