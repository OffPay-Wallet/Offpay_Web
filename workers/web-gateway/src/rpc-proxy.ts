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
const rpcPayloadSchema = z.union([rpcEnvelopeSchema, z.array(rpcEnvelopeSchema).min(1).max(25)]);
type RpcEnvelope = z.infer<typeof rpcEnvelopeSchema>;

export type RpcProxyNetwork = "devnet" | "mainnet";

const allowedRpcMethods = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlock",
  "getBlockCommitment",
  "getBlockHeight",
  "getBlockProduction",
  "getBlocks",
  "getBlocksWithLimit",
  "getBlockTime",
  "getClusterNodes",
  "getEpochInfo",
  "getEpochSchedule",
  "getFeeForMessage",
  "getFirstAvailableBlock",
  "getGenesisHash",
  "getHealth",
  "getHighestSnapshotSlot",
  "getIdentity",
  "getInflationGovernor",
  "getInflationRate",
  "getInflationReward",
  "getLargestAccounts",
  "getLatestBlockhash",
  "getLeaderSchedule",
  "getMaxRetransmitSlot",
  "getMaxShredInsertSlot",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getProgramAccounts",
  "getRecentPerformanceSamples",
  "getRecentPrioritizationFees",
  "getSignaturesForAddress",
  "getSignatureStatuses",
  "getSlot",
  "getSlotLeader",
  "getSlotLeaders",
  "getStakeMinimumDelegation",
  "getSupply",
  "getTokenAccountBalance",
  "getTokenAccountsByDelegate",
  "getTokenAccountsByOwner",
  "getTokenLargestAccounts",
  "getTokenSupply",
  "getTransaction",
  "getTransactionCount",
  "getVersion",
  "getVoteAccounts",
  "isBlockhashValid",
  "minimumLedgerSlot",
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

function validateRpcPayload(body: unknown): z.infer<typeof rpcPayloadSchema> {
  const parsed = rpcPayloadSchema.safeParse(body);

  if (!parsed.success) {
    throw new RpcProxyError(
      "rpc_invalid_request",
      "Solana RPC request must be a JSON-RPC 2.0 object or batch.",
      400,
    );
  }

  const requests = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  for (const request of requests) {
    if (!allowedRpcMethods.has(request.method)) {
      throw new RpcProxyError(
        "rpc_method_not_allowed",
        "This Solana RPC method is not allowed through the Web Gateway.",
        400,
      );
    }
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

function jsonResponseHeaders(): Headers {
  const headers = new Headers();

  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json");

  return headers;
}

async function fetchRpcEnvelope(rpcUrl: string, envelope: RpcEnvelope): Promise<Response> {
  try {
    return await fetch(rpcUrl, {
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
}

async function proxySingleRpcEnvelope(rpcUrl: string, envelope: RpcEnvelope): Promise<Response> {
  const upstream = await fetchRpcEnvelope(rpcUrl, envelope);

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

async function proxyRpcBatch(rpcUrl: string, batch: RpcEnvelope[]): Promise<Response> {
  const envelopes = await Promise.all(
    batch.map(async (envelope) => {
      const upstream = await fetchRpcEnvelope(rpcUrl, envelope);

      if (!upstream.ok) {
        return rpcErrorEnvelope(
          envelope.id,
          -32000,
          `Solana RPC returned HTTP ${upstream.status}.`,
        );
      }

      try {
        return await upstream.json();
      } catch {
        return rpcErrorEnvelope(envelope.id, -32700, "Solana RPC returned invalid JSON.");
      }
    }),
  );

  return Response.json(envelopes, {
    headers: jsonResponseHeaders(),
  });
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
  const payload = validateRpcPayload(body);
  const providerConfig = rpcProviderConfig(env, rpcNetworkToCluster(network));
  const rpcUrl = providerConfig.urls[0];

  if (!rpcUrl) {
    throw new RpcProxyError(
      "rpc_config_missing",
      "No Solana RPC provider is configured for this network.",
      503,
    );
  }

  if (Array.isArray(payload)) {
    return proxyRpcBatch(rpcUrl, payload);
  }

  return proxySingleRpcEnvelope(rpcUrl, payload);
}
