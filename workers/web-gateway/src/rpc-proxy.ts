import { z } from "zod";

import type { SolanaCluster } from "../../../src/lib/offpay/types";
import { rpcProviderConfig } from "./rpc-core";
import type { GatewayEnv } from "./types";

const rpcEnvelopeSchema = z.object({
  id: z.unknown().optional(),
  jsonrpc: z.literal("2.0").optional(),
  method: z.string().min(1).max(64),
  params: z.unknown().optional(),
});

export type RpcProxyNetwork = "devnet" | "mainnet";

const allowedRpcMethods = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlockHeight",
  "getEpochInfo",
  "getFeeForMessage",
  "getLatestBlockhash",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getProgramAccounts",
  "getSignatureStatuses",
  "getSlot",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getTransaction",
  "sendTransaction",
  "simulateTransaction",
]);

export class RpcProxyError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "RpcProxyError";
    this.code = code;
    this.status = status;
  }
}

export function rpcNetworkToCluster(network: RpcProxyNetwork): SolanaCluster {
  return network === "devnet" ? "solana:devnet" : "solana:mainnet";
}

function rpcErrorEnvelope(id: unknown, code: number, message: string): Record<string, unknown> {
  return {
    error: { code, message },
    id: id ?? null,
    jsonrpc: "2.0",
  };
}

async function parseRpcBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new RpcProxyError("rpc_invalid_json", "Solana RPC request body is invalid JSON.", 400);
  }
}

function validateRpcEnvelope(body: unknown): z.infer<typeof rpcEnvelopeSchema> {
  const parsed = rpcEnvelopeSchema.safeParse(body);

  if (!parsed.success) {
    throw new RpcProxyError(
      "rpc_invalid_request",
      "Solana RPC request must be a JSON-RPC 2.0 object.",
      400,
    );
  }

  if (!allowedRpcMethods.has(parsed.data.method)) {
    throw new RpcProxyError(
      "rpc_method_not_allowed",
      "This Solana RPC method is not allowed through the Web Gateway.",
      400,
    );
  }

  return parsed.data;
}

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");

  headers.set("cache-control", "no-store");
  headers.set("content-type", contentType?.includes("application/json") ? contentType : "application/json");

  return headers;
}

export async function proxySolanaRpc({
  env,
  network,
  request,
}: {
  env: GatewayEnv;
  network: RpcProxyNetwork;
  request: Request;
}): Promise<Response> {
  const body = await parseRpcBody(request);
  const envelope = validateRpcEnvelope(body);
  const providerConfig = rpcProviderConfig(env, rpcNetworkToCluster(network));
  const rpcUrl = providerConfig.urls[0];

  if (!rpcUrl) {
    throw new RpcProxyError(
      "rpc_config_missing",
      "No Solana RPC provider is configured for this network.",
      503,
    );
  }

  let upstream: Response;

  try {
    upstream = await fetch(rpcUrl, {
      body: JSON.stringify(envelope),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
  } catch {
    throw new RpcProxyError(
      "rpc_network_error",
      "Unable to reach the configured Solana RPC provider.",
      502,
    );
  }

  if (!upstream.ok) {
    return Response.json(
      rpcErrorEnvelope(envelope.id, -32000, `Solana RPC returned HTTP ${upstream.status}.`),
      {
        headers: responseHeaders(upstream),
        status: 502,
      },
    );
  }

  return new Response(upstream.body, {
    headers: responseHeaders(upstream),
    status: upstream.status,
  });
}
