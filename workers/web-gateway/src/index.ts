import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import type { SolanaCluster } from "../../../src/lib/offpay/types";
import { isAllowedOrigin } from "./cors";
import { fail, ok } from "./envelope";
import {
  manualWorkflowConfigStatus,
  manualWorkflowRoutes,
  type ManualWorkflowRoute,
} from "./manual-config";
import {
  appendServerTiming,
  durationSince,
  gatewayDebugLog,
  gatewayWarnLog,
  nowMs,
  readClientRequestId,
  redactIdentifier,
  roundedDurationMs,
} from "./observability";
import { fetchWalletPortfolioFromRpc, RpcBalanceError } from "./rpc-balance";
import {
  createChallenge,
  createSessionToken,
  readSessionToken,
  verifyChallenge,
} from "./session";
import type { GatewayBindings, GatewayEnv } from "./types";

const sessionCookieName = "offpay_web_session";
const allowedMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const allowedHeaders =
  "accept,authorization,content-type,x-offpay-request-id,x-requested-with";
const exposedHeaders =
  "server-timing,x-offpay-request-id,x-ratelimit-limit,x-ratelimit-remaining,x-ratelimit-reset";

const nonceSchema = z.object({
  walletAddress: z.string().min(32),
  network: z.enum(["solana:devnet", "solana:testnet", "solana:mainnet"]),
  custody: z.enum(["external-solana", "privy-solana"]).default("external-solana"),
  deviceId: z.string().min(1).optional(),
});

const verifySchema = nonceSchema.extend({
  challengeToken: z.string().min(32),
  message: z.string().min(16),
  signature: z.string().min(32),
  signedMessage: z.string().min(32),
});
const publicBalancesSchema = z.object({
  address: z.string().min(32),
  network: z.enum(["solana:devnet", "solana:testnet", "solana:mainnet"]),
});

function sessionSecret(env: GatewayEnv): string | undefined {
  const secret = env.OFFPAY_WEB_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : undefined;
}

function authorizationSessionToken(c: Context<GatewayBindings>): string | undefined {
  const authorization = c.req.header("authorization")?.trim();
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  return token && token.length > 0 ? token : undefined;
}

function requireOrigin(c: Context<GatewayBindings>): Response | null {
  const origin = c.req.header("origin");

  if (origin && !isAllowedOrigin(c.env, origin)) {
    gatewayWarnLog(c, "cors.origin_not_allowed", {
      origin,
    });
    return fail(c, 403, {
      code: "origin_not_allowed",
      message: "This browser origin is not allowed for the Offpay Web Gateway.",
    });
  }

  return null;
}

const withRequestContext = createMiddleware<GatewayBindings>(async (c, next) => {
  const startedAtMs = nowMs();
  const requestId =
    readClientRequestId(c.req.header("x-offpay-request-id")) ?? crypto.randomUUID();

  c.set("requestId", requestId);
  c.set("startedAtMs", startedAtMs);
  gatewayDebugLog(c, "request.start", {
    origin: c.req.header("origin"),
  });

  try {
    await next();
  } finally {
    const durationMs = durationSince(startedAtMs);

    appendServerTiming(c, "gateway", durationMs);
    c.header("x-offpay-request-id", requestId);
    gatewayDebugLog(c, "request.end", {
      durationMs: roundedDurationMs(durationMs),
      status: c.res.status,
    });
  }

  return;
});

const withAllowedOrigin = createMiddleware<GatewayBindings>(async (c, next) => {
  const originError = requireOrigin(c);

  if (originError) {
    return originError;
  }

  await next();
  return;
});

const withCors = createMiddleware<GatewayBindings>(async (c, next) => {
  const origin = c.req.header("origin");

  if (c.req.method === "OPTIONS") {
    c.header("vary", "origin");

    if (isAllowedOrigin(c.env, origin)) {
      c.header("access-control-allow-origin", origin);
      c.header("access-control-allow-credentials", "true");
      c.header("access-control-allow-methods", allowedMethods);
      c.header("access-control-allow-headers", allowedHeaders);
      c.header("access-control-expose-headers", exposedHeaders);
      gatewayDebugLog(c, "cors.preflight.allowed", {
        origin,
      });

      return c.body(null, 204);
    }

    gatewayWarnLog(c, "cors.preflight.blocked", {
      origin,
    });
    return fail(c, 403, {
      code: "origin_not_allowed",
      message: "This browser origin is not allowed for the Offpay Web Gateway.",
    });
  }

  await next();

  if (isAllowedOrigin(c.env, origin)) {
    c.header("access-control-allow-origin", origin);
    c.header("access-control-allow-credentials", "true");
    c.header("access-control-expose-headers", exposedHeaders);
    c.header("vary", "origin");
  }

  return;
});

const requireSession = createMiddleware<GatewayBindings>(async (c, next) => {
  const secret = sessionSecret(c.env);

  if (!secret) {
    gatewayWarnLog(c, "session.secret_missing");
    return fail(c, 503, {
      code: "session_secret_missing",
      message: "Gateway session secret is not configured.",
    });
  }

  const token = getCookie(c, sessionCookieName) ?? authorizationSessionToken(c);

  if (!token) {
    gatewayDebugLog(c, "session.missing");
    return fail(c, 401, {
      code: "session_missing",
      message: "Create a signed Gateway session before calling this route.",
    });
  }

  const session = await readSessionToken(token, secret);

  if (!session) {
    gatewayWarnLog(c, "session.invalid");
    return fail(c, 401, {
      code: "session_invalid",
      message: "Gateway session expired or failed verification.",
    });
  }

  c.set("session", session);
  gatewayDebugLog(c, "session.ready", {
    cluster: session.identity.cluster,
    walletAddress: redactIdentifier(session.identity.address),
  });
  await next();
  return;
});

const app = new Hono<GatewayBindings>();

app.use("*", withRequestContext);
app.use("*", withCors);
app.use("/web/*", withAllowedOrigin);

app.get("/health", (c) =>
  ok(c, {
    service: "offpay-web-gateway",
    status: "ok",
  }),
);

app.post("/web/session/nonce", zValidator("json", nonceSchema), async (c) => {
  const secret = sessionSecret(c.env);

  if (!secret) {
    gatewayWarnLog(c, "session.nonce.secret_missing");
    return fail(c, 503, {
      code: "session_secret_missing",
      message: "Gateway session secret is not configured.",
    });
  }

  const input = c.req.valid("json");
  gatewayDebugLog(c, "session.nonce.start", {
    network: input.network,
    custody: input.custody,
    walletAddress: redactIdentifier(input.walletAddress),
  });
  const nonce = await createChallenge({
    walletAddress: input.walletAddress,
    network: input.network,
    custody: input.custody,
    secret,
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
  });

  gatewayDebugLog(c, "session.nonce.success", {
    expiresAt: nonce.expiresAt,
    network: input.network,
    custody: input.custody,
    walletAddress: redactIdentifier(input.walletAddress),
  });

  return ok(c, nonce);
});

app.post("/web/session/verify", zValidator("json", verifySchema), async (c) => {
  const secret = sessionSecret(c.env);

  if (!secret) {
    gatewayWarnLog(c, "session.verify.secret_missing");
    return fail(c, 503, {
      code: "session_secret_missing",
      message: "Gateway session secret is not configured.",
    });
  }

  const input = c.req.valid("json");
  gatewayDebugLog(c, "session.verify.start", {
    network: input.network,
    custody: input.custody,
    walletAddress: redactIdentifier(input.walletAddress),
  });
  const result = await verifyChallenge(
    {
      challengeToken: input.challengeToken,
      walletAddress: input.walletAddress,
      network: input.network,
      custody: input.custody,
      message: input.message,
      signature: input.signature,
      signedMessage: input.signedMessage,
      ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    },
    secret,
  );

  if (!result.ok) {
    gatewayWarnLog(c, "session.verify.signature_invalid", {
      reason: result.reason,
      network: input.network,
      custody: input.custody,
      walletAddress: redactIdentifier(input.walletAddress),
    });
    return fail(c, 401, {
      code: "signature_invalid",
      message: result.reason,
    });
  }

  const sessionToken = await createSessionToken(result.session, secret);
  setCookie(c, sessionCookieName, sessionToken, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "None",
    secure: true,
  });

  gatewayDebugLog(c, "session.verify.success", {
    cluster: result.session.identity.cluster,
    custody: result.session.identity.custody,
    expiresAt: result.session.expiresAt,
    walletAddress: redactIdentifier(result.session.identity.address),
  });

  return ok(c, {
    session: result.session,
    sessionToken,
  });
});

app.get("/web/session/status", async (c) => {
  const secret = sessionSecret(c.env);

  if (!secret) {
    gatewayWarnLog(c, "session.status.secret_missing");
    return fail(c, 503, {
      code: "session_secret_missing",
      message: "Gateway session secret is not configured.",
    });
  }

  const token = getCookie(c, sessionCookieName) ?? authorizationSessionToken(c);

  if (!token) {
    gatewayDebugLog(c, "session.status.missing");
    return ok(c, null);
  }

  const session = await readSessionToken(token, secret);

  if (!session) {
    gatewayWarnLog(c, "session.status.invalid");
    return ok(c, null);
  }

  gatewayDebugLog(c, "session.status.success", {
    cluster: session.identity.cluster,
    custody: session.identity.custody,
    walletAddress: redactIdentifier(session.identity.address),
  });

  return ok(c, session);
});

async function readWalletPortfolio(
  c: Context<GatewayBindings>,
  {
    address,
    cluster,
    label,
  }: {
    address: string;
    cluster: SolanaCluster;
    label: string;
  },
) {
  const startedAtMs = nowMs();
  gatewayDebugLog(c, `${label}.start`, {
    cluster,
    walletAddress: redactIdentifier(address),
  });

  try {
    const portfolio = await fetchWalletPortfolioFromRpc({
      address,
      cluster,
      env: c.env,
    });
    const durationMs = durationSince(startedAtMs);

    appendServerTiming(c, "balances", durationMs);
    gatewayDebugLog(c, `${label}.success`, {
      cluster: portfolio.cluster,
      durationMs: roundedDurationMs(durationMs),
      tokenCount: portfolio.tokens.length,
      walletAddress: redactIdentifier(portfolio.address),
    });
    return ok(c, portfolio);
  } catch (error) {
    const durationMs = durationSince(startedAtMs);

    appendServerTiming(c, "balances", durationMs);
    if (error instanceof RpcBalanceError) {
      gatewayWarnLog(c, `${label}.rpc_error`, {
        code: error.code,
        durationMs: roundedDurationMs(durationMs),
        message: error.message,
        status: error.status,
        walletAddress: redactIdentifier(address),
      });
      return fail(c, error.status, {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      });
    }

    gatewayWarnLog(c, `${label}.unknown_error`, {
      durationMs: roundedDurationMs(durationMs),
      walletAddress: redactIdentifier(address),
    });
    return fail(c, 502, {
      code: "balances_unavailable",
      message: "Unable to read wallet balances from configured Solana RPC providers.",
    });
  }
}

app.get("/web/config/status", (c) => ok(c, manualWorkflowConfigStatus(c.env)));

app.get("/web/public/balances", zValidator("query", publicBalancesSchema), async (c) => {
  const input = c.req.valid("query");

  return readWalletPortfolio(c, {
    address: input.address,
    cluster: input.network,
    label: "public_balances",
  });
});

app.get("/web/balances", requireSession, async (c) => {
  const session = c.get("session");

  return readWalletPortfolio(c, {
    address: session.identity.address,
    cluster: session.identity.cluster,
    label: "balances",
  });
});

app.get("/web/wallet/balance", requireSession, async (c) => {
  const session = c.get("session");

  return readWalletPortfolio(c, {
    address: session.identity.address,
    cluster: session.identity.cluster,
    label: "wallet_balance",
  });
});

function manualRouteHandler(route: ManualWorkflowRoute) {
  return (c: Context<GatewayBindings>) =>
    fail(c, 501, {
      code: "manual_route_not_implemented",
      message: `${route.method} ${route.path} is configured on the Web Gateway but not implemented yet.`,
      details: {
        route: {
          method: route.method,
          path: route.path,
          capability: route.capability,
          configGroups: route.configGroups,
        },
        configStatus: manualWorkflowConfigStatus(c.env).groups,
      },
    });
}

for (const route of manualWorkflowRoutes) {
  if (!route.implemented) {
    app.on(route.method, route.path, requireSession, manualRouteHandler(route));
  }
}

app.notFound((c) =>
  fail(c, 404, {
    code: "not_found",
    message: "Gateway route not found.",
  }),
);

export default app;
