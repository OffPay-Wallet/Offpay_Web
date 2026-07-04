import { z } from "zod";

import type { SolanaCluster } from "../../../src/lib/offpay/types";
import type { GatewayEnv } from "./types";

const rpcEnvelopeSchema = z.object({
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number().optional(),
      message: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

type RpcProviderConfig = {
  urls: string[];
  expectedKeys: string[];
};

export class RpcBalanceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor({
    code,
    details,
    message,
    status,
  }: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, unknown>;
  }) {
    super(message);
    this.name = "RpcBalanceError";
    this.code = code;
    this.status = status;

    if (details) {
      this.details = details;
    }
  }
}

export function configuredUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed && /^https:\/\//i.test(trimmed) ? trimmed : null;
}

export function rpcProviderConfig(env: GatewayEnv, cluster: SolanaCluster): RpcProviderConfig {
  if (cluster === "solana:devnet") {
    const expectedKeys = [
      "HELIUS_DEVNET_RPC_URL",
      "ALCHEMY_DEVNET_RPC_URL",
      "ALCHEMY_DEVNET_FALLBACK_RPC_URL",
    ];
    return {
      expectedKeys,
      urls: [
        configuredUrl(env.HELIUS_DEVNET_RPC_URL),
        configuredUrl(env.ALCHEMY_DEVNET_RPC_URL),
        configuredUrl(env.ALCHEMY_DEVNET_FALLBACK_RPC_URL),
      ].filter((url): url is string => Boolean(url)),
    };
  }

  if (cluster === "solana:mainnet") {
    const expectedKeys = [
      "HELIUS_MAINNET_RPC_URL",
      "ALCHEMY_MAINNET_RPC_URL",
      "ALCHEMY_MAINNET_FALLBACK_RPC_URL",
    ];
    return {
      expectedKeys,
      urls: [
        configuredUrl(env.HELIUS_MAINNET_RPC_URL),
        configuredUrl(env.ALCHEMY_MAINNET_RPC_URL),
        configuredUrl(env.ALCHEMY_MAINNET_FALLBACK_RPC_URL),
      ].filter((url): url is string => Boolean(url)),
    };
  }

  return {
    expectedKeys: [],
    urls: [],
  };
}

export function metadataRpcUrl(env: GatewayEnv, cluster: SolanaCluster): string | null {
  if (cluster === "solana:devnet") {
    return configuredUrl(env.HELIUS_DEVNET_RPC_URL);
  }

  if (cluster === "solana:mainnet") {
    return configuredUrl(env.HELIUS_MAINNET_RPC_URL);
  }

  return null;
}

export async function rpcRequest(
  url: string,
  method: string,
  params: unknown,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new RpcBalanceError({
      code: "rpc_http_error",
      message: `Solana RPC returned HTTP ${response.status}.`,
      status: 502,
    });
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new RpcBalanceError({
      code: "rpc_invalid_json",
      message: "Solana RPC returned invalid JSON.",
      status: 502,
    });
  }

  const envelope = rpcEnvelopeSchema.safeParse(payload);

  if (!envelope.success) {
    throw new RpcBalanceError({
      code: "rpc_invalid_response",
      message: "Solana RPC returned an unexpected response envelope.",
      status: 502,
    });
  }

  if (envelope.data.error) {
    throw new RpcBalanceError({
      code: "rpc_error",
      message: envelope.data.error.message ?? `${method} failed at the Solana RPC provider.`,
      status: 502,
    });
  }

  return envelope.data.result;
}
