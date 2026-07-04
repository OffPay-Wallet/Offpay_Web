import type { SolanaCluster } from "../../../src/lib/offpay/types";
import type { GatewayEnv } from "./types";

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function explorerClusterValue(cluster: SolanaCluster): {
  clusterName: string;
  clusterQuery: string;
  networkName: string;
} {
  const networkName = cluster.replace("solana:", "");

  if (networkName === "mainnet") {
    return {
      clusterName: "mainnet-beta",
      clusterQuery: "?cluster=mainnet-beta",
      networkName,
    };
  }

  return {
    clusterName: networkName,
    clusterQuery: `?cluster=${encodeURIComponent(networkName)}`,
    networkName,
  };
}

function transactionExplorerTemplate(
  env: GatewayEnv,
  cluster: SolanaCluster,
): string | null {
  if (cluster === "solana:mainnet") {
    return nonEmpty(env.OFFPAY_SOLANA_MAINNET_EXPLORER_TX_URL_TEMPLATE);
  }

  if (cluster === "solana:devnet") {
    return nonEmpty(env.OFFPAY_SOLANA_DEVNET_EXPLORER_TX_URL_TEMPLATE);
  }

  return nonEmpty(env.OFFPAY_SOLANA_TESTNET_EXPLORER_TX_URL_TEMPLATE);
}

export function buildTransactionExplorerUrl({
  cluster,
  env,
  signature,
}: {
  cluster: SolanaCluster;
  env: GatewayEnv;
  signature: string;
}): string | null {
  const template = transactionExplorerTemplate(env, cluster);
  if (!template) return null;

  const { clusterName, clusterQuery, networkName } = explorerClusterValue(cluster);

  return template
    .replaceAll("{signature}", encodeURIComponent(signature))
    .replaceAll("{cluster}", encodeURIComponent(clusterName))
    .replaceAll("{network}", encodeURIComponent(networkName))
    .replaceAll("{clusterQuery}", clusterQuery);
}
