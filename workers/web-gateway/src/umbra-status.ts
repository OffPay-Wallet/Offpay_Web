import type { SolanaCluster, UmbraGatewayStatus, UmbraNetwork } from "../../../src/lib/offpay/types";
import type { GatewayEnv } from "./types";

type UmbraBindingKey = keyof Pick<
  GatewayEnv,
  | "UMBRA_CIRCUIT_VERSION"
  | "UMBRA_INDEXER_URL_DEVNET"
  | "UMBRA_INDEXER_URL_MAINNET"
  | "UMBRA_LOCAL_TEST_MODE"
  | "UMBRA_MIN_SDK_VERSION"
  | "UMBRA_RELAYER_URL_DEVNET"
  | "UMBRA_RELAYER_URL_MAINNET"
>;

const runtimeKeys: UmbraBindingKey[] = [
  "UMBRA_CIRCUIT_VERSION",
  "UMBRA_MIN_SDK_VERSION",
  "UMBRA_LOCAL_TEST_MODE",
];

function hasBinding(env: GatewayEnv, key: UmbraBindingKey): boolean {
  return Boolean(env[key]?.trim());
}

function clusterToUmbraNetwork(cluster: SolanaCluster): UmbraNetwork | null {
  if (cluster === "solana:devnet") return "devnet";
  if (cluster === "solana:mainnet") return "mainnet";
  return null;
}

export function readUmbraGatewayStatus(
  env: GatewayEnv,
  cluster: SolanaCluster,
): UmbraGatewayStatus {
  const network = clusterToUmbraNetwork(cluster);

  if (!network) {
    return {
      cluster,
      configured: false,
      missing: [],
      network: null,
      services: {
        indexer: false,
        relayer: false,
        runtime: runtimeKeys.every((key) => hasBinding(env, key)),
      },
      supported: false,
    };
  }

  const indexerKey =
    network === "devnet" ? "UMBRA_INDEXER_URL_DEVNET" : "UMBRA_INDEXER_URL_MAINNET";
  const relayerKey =
    network === "devnet" ? "UMBRA_RELAYER_URL_DEVNET" : "UMBRA_RELAYER_URL_MAINNET";
  const requiredKeys: UmbraBindingKey[] = [indexerKey, relayerKey, ...runtimeKeys];
  const missing = requiredKeys.filter((key) => !hasBinding(env, key));

  return {
    cluster,
    configured: missing.length === 0,
    missing,
    network,
    services: {
      indexer: hasBinding(env, indexerKey),
      relayer: hasBinding(env, relayerKey),
      runtime: runtimeKeys.every((key) => hasBinding(env, key)),
    },
    supported: true,
  };
}
