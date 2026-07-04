import { z } from "zod";

import type {
  SolanaCluster,
  WalletTransactionSignature,
  WalletTransactionsResponse,
} from "../../../src/lib/offpay/types";
import { RpcBalanceError, rpcProviderConfig, rpcRequest } from "./rpc-core";
import { enrichSignaturesWithAssets } from "./transaction-assets";
import type { GatewayEnv } from "./types";

const signatureInfoSchema = z.object({
  signature: z.string().min(1),
  slot: z.number().int().nonnegative().nullish(),
  err: z.unknown().nullish(),
  memo: z.string().nullish(),
  blockTime: z.number().int().nullish(),
  confirmationStatus: z.string().nullish(),
});

const signaturesResultSchema = z.array(signatureInfoSchema);

function toSignature(
  item: z.infer<typeof signatureInfoSchema>,
): WalletTransactionSignature {
  return {
    signature: item.signature,
    slot: item.slot ?? null,
    blockTime: item.blockTime ?? null,
    memo: item.memo ?? null,
    failed: item.err != null,
    confirmationStatus: item.confirmationStatus ?? null,
  };
}

async function fetchSignaturesFromUrl(
  url: string,
  address: string,
  options: { limit: number; before?: string },
): Promise<WalletTransactionSignature[]> {
  const rawResult = await rpcRequest(url, "getSignaturesForAddress", [
    address,
    {
      limit: options.limit,
      ...(options.before ? { before: options.before } : {}),
    },
  ]);

  return signaturesResultSchema.parse(rawResult).map(toSignature);
}

export async function fetchWalletSignaturesFromRpc({
  address,
  before,
  cluster,
  env,
  limit,
}: {
  address: string;
  before?: string;
  cluster: SolanaCluster;
  env: GatewayEnv;
  limit: number;
}): Promise<WalletTransactionsResponse> {
  const providerConfig = rpcProviderConfig(env, cluster);

  if (providerConfig.urls.length === 0) {
    throw new RpcBalanceError({
      code: "rpc_config_missing",
      message: `No gateway RPC URL is configured for ${cluster}.`,
      status: 503,
      details: {
        expectedKeys: providerConfig.expectedKeys,
      },
    });
  }

  let lastError: unknown;

  for (const url of providerConfig.urls) {
    try {
      const signatures = await fetchSignaturesFromUrl(url, address, {
        limit,
        ...(before ? { before } : {}),
      });
      const enrichedSignatures = await enrichSignaturesWithAssets({
        address,
        cluster,
        env,
        signatures,
        url,
      });

      return {
        address,
        cluster,
        fetchedAt: new Date().toISOString(),
        signatures: enrichedSignatures,
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof RpcBalanceError) {
    throw lastError;
  }

  throw new RpcBalanceError({
    code: "transactions_unavailable",
    message: "Unable to read wallet transactions from configured Solana RPC providers.",
    status: 502,
  });
}
