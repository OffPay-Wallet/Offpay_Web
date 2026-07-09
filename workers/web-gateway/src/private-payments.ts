import type { Context } from "hono";
import { z } from "zod";

import type { WebSession } from "../../../src/lib/offpay/types";
import { fail, ok } from "./envelope";
import {
  appendServerTiming,
  durationSince,
  gatewayDebugLog,
  gatewayWarnLog,
  nowMs,
  redactIdentifier,
  roundedDurationMs,
} from "./observability";
import { configuredUrl } from "./rpc-core";
import type { GatewayBindings, GatewayEnv } from "./types";

const amountAtomicSchema = z.string().regex(/^[1-9]\d*$/);
const sendToSchema = z.enum(["base", "ephemeral"]);
type MagicBlockCluster = "devnet-private" | "mainnet-private";

const magicBlockPrepareSchema = z.object({
  action: z.literal("prepare"),
  amountAtomic: amountAtomicSchema,
  memo: z.string().trim().min(1).max(80).optional(),
  mint: z.string().min(32),
  provider: z.literal("magicblock"),
  recipient: z.string().min(32),
});

const magicBlockSubmitSchema = z.object({
  action: z.literal("submit"),
  lastValidBlockHeight: z.number().int().nonnegative(),
  provider: z.literal("magicblock"),
  recentBlockhash: z.string().min(1),
  sendRpcEndpoint: z.string().url().optional(),
  sendTo: sendToSchema,
  transactionBase64: z.string().min(1),
});

export const privateSendRequestSchema = z.discriminatedUnion("action", [
  magicBlockPrepareSchema,
  magicBlockSubmitSchema,
]);

const unsignedTransferSchema = z.object({
  fees: z
    .object({
      lamports: z.string(),
      tokens: z.string(),
    })
    .optional(),
  instructionCount: z.number().int().nonnegative(),
  kind: z.literal("transfer"),
  lastValidBlockHeight: z.number().int().nonnegative(),
  recentBlockhash: z.string().min(1),
  requiredSigners: z.array(z.string()),
  sendRpcEndpoint: z.string().url().optional(),
  sendTo: sendToSchema,
  transactionBase64: z.string().min(1),
  validator: z.string().optional(),
  version: z.enum(["legacy", "v0"]),
});

const submittedTransferSchema = z.object({
  confirmationRequiresAuthToken: z.boolean(),
  confirmationRpcEndpoint: z.string().url(),
  confirmed: z.boolean(),
  sendTo: sendToSchema,
  signature: z.string().min(32),
});

const upstreamErrorSchema = z.object({
  error: z.object({
    code: z.string().optional(),
    details: z.unknown().optional(),
    message: z.string().optional(),
  }),
});

class PrivatePaymentGatewayError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly status: number;

  constructor({
    code,
    details,
    message,
    status,
  }: {
    code: string;
    details?: Record<string, unknown>;
    message: string;
    status: number;
  }) {
    super(message);
    this.name = "PrivatePaymentGatewayError";
    this.code = code;
    if (details) {
      this.details = details;
    }
    this.status = status;
  }
}

function readMagicBlockOrigin(env: GatewayEnv): string {
  const origin = configuredUrl(env.MAGICBLOCK_PRIVATE_PAYMENTS_API_ORIGIN);

  if (!origin) {
    throw new PrivatePaymentGatewayError({
      code: "magicblock_api_missing",
      message: "MagicBlock Private Payments API origin is not configured.",
      status: 503,
    });
  }

  return origin;
}

function clusterForSession(session: WebSession): MagicBlockCluster {
  if (session.identity.cluster === "solana:mainnet") return "mainnet-private";
  if (session.identity.cluster === "solana:devnet") return "devnet-private";

  throw new PrivatePaymentGatewayError({
    code: "magicblock_network_unsupported",
    message: "MagicBlock private payments are available on devnet and mainnet only.",
    status: 400,
  });
}

function safeAmountNumber(amountAtomic: string): number {
  const amount = Number(amountAtomic);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new PrivatePaymentGatewayError({
      code: "magicblock_amount_unsupported",
      message: "Amount is too large for the MagicBlock transaction builder.",
      status: 400,
    });
  }

  return amount;
}

async function readUpstreamJson(response: Response, path: string): Promise<unknown> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new PrivatePaymentGatewayError({
      code: "magicblock_invalid_json",
      details: { path, upstreamStatus: response.status },
      message: "MagicBlock returned invalid JSON.",
      status: 502,
    });
  }

  if (response.ok) return payload;

  const parsed = upstreamErrorSchema.safeParse(payload);
  throw new PrivatePaymentGatewayError({
    code: parsed.data?.error.code ?? "magicblock_upstream_error",
    details: { path, upstreamStatus: response.status },
    message: parsed.data?.error.message ?? "MagicBlock private payment request failed.",
    status: response.status >= 400 && response.status < 500 ? response.status : 502,
  });
}

async function postMagicBlock({
  body,
  env,
  path,
}: {
  body: Record<string, unknown>;
  env: GatewayEnv;
  path: string;
}): Promise<unknown> {
  const target = new URL(path, readMagicBlockOrigin(env));
  const response = await fetch(target, {
    body: JSON.stringify(body),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    method: "POST",
  });

  return readUpstreamJson(response, path);
}

async function prepareMagicBlockPrivateSend(
  c: Context<GatewayBindings>,
  input: z.infer<typeof magicBlockPrepareSchema>,
) {
  const session = c.get("session");
  const cluster = clusterForSession(session);
  const payload = await postMagicBlock({
    env: c.env,
    path: "/v1/spl/transfer",
    body: {
      amount: safeAmountNumber(input.amountAtomic),
      cluster,
      from: session.identity.address,
      fromBalance: "base",
      initAtasIfMissing: true,
      initIfMissing: true,
      initVaultIfMissing: true,
      maxDelayMs: "0",
      minDelayMs: "0",
      mint: input.mint,
      split: 1,
      to: input.recipient,
      toBalance: "base",
      visibility: "private",
      ...(input.memo ? { memo: input.memo } : {}),
    },
  });
  const parsed = unsignedTransferSchema.safeParse(payload);

  if (!parsed.success) {
    throw new PrivatePaymentGatewayError({
      code: "magicblock_invalid_prepare_response",
      details: { path: "/v1/spl/transfer" },
      message: "MagicBlock returned an unexpected transfer response.",
      status: 502,
    });
  }

  gatewayDebugLog(c, "private_send.magicblock.prepare.success", {
    cluster,
    sendTo: parsed.data.sendTo,
    walletAddress: redactIdentifier(session.identity.address),
  });
  return parsed.data;
}

async function submitMagicBlockPrivateSend(
  c: Context<GatewayBindings>,
  input: z.infer<typeof magicBlockSubmitSchema>,
) {
  const session = c.get("session");
  const cluster = clusterForSession(session);
  const payload = await postMagicBlock({
    env: c.env,
    path: "/v1/transaction/send",
    body: {
      cluster,
      confirm: true,
      lastValidBlockHeight: input.lastValidBlockHeight,
      maxRetries: 3,
      recentBlockhash: input.recentBlockhash,
      sendTo: input.sendTo,
      skipPreflight: false,
      transactionBase64: input.transactionBase64,
      ...(input.sendRpcEndpoint ? { sendRpcEndpoint: input.sendRpcEndpoint } : {}),
    },
  });
  const parsed = submittedTransferSchema.safeParse(payload);

  if (!parsed.success) {
    throw new PrivatePaymentGatewayError({
      code: "magicblock_invalid_submit_response",
      details: { path: "/v1/transaction/send" },
      message: "MagicBlock returned an unexpected submission response.",
      status: 502,
    });
  }

  gatewayDebugLog(c, "private_send.magicblock.submit.success", {
    cluster,
    confirmed: parsed.data.confirmed,
    sendTo: parsed.data.sendTo,
    walletAddress: redactIdentifier(session.identity.address),
  });
  return parsed.data;
}

export async function handlePrivateSendRequest(
  c: Context<GatewayBindings>,
  input: z.infer<typeof privateSendRequestSchema>,
): Promise<Response> {
  const startedAtMs = nowMs();

  try {
    const data =
      input.action === "prepare"
        ? await prepareMagicBlockPrivateSend(c, input)
        : await submitMagicBlockPrivateSend(c, input);
    const durationMs = durationSince(startedAtMs);

    appendServerTiming(c, "private-send", durationMs);
    gatewayDebugLog(c, "private_send.success", {
      action: input.action,
      durationMs: roundedDurationMs(durationMs),
      provider: input.provider,
    });
    return ok(c, data);
  } catch (error) {
    const durationMs = durationSince(startedAtMs);

    appendServerTiming(c, "private-send", durationMs);

    if (error instanceof PrivatePaymentGatewayError) {
      gatewayWarnLog(c, "private_send.error", {
        action: input.action,
        code: error.code,
        details: error.details,
        durationMs: roundedDurationMs(durationMs),
        provider: input.provider,
        status: error.status,
      });

      return fail(c, error.status, {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      });
    }

    gatewayWarnLog(c, "private_send.unknown_error", {
      action: input.action,
      durationMs: roundedDurationMs(durationMs),
      provider: input.provider,
    });
    return fail(c, 502, {
      code: "private_send_unavailable",
      message: "Private payment provider is unavailable.",
    });
  }
}
