import type { Context } from "hono";

import type { WebApiEnvelope, WebApiError } from "../../../src/lib/offpay/types";
import type { GatewayBindings } from "./types";

export function requestId(c: Context<GatewayBindings>): string {
  const existing = c.get("requestId");

  if (existing) {
    return existing;
  }

  return crypto.randomUUID();
}

export function ok<T>(c: Context<GatewayBindings>, data: T, status = 200): Response {
  const envelope: WebApiEnvelope<T> = {
    ok: true,
    data,
    requestId: requestId(c),
  };

  return Response.json(envelope, {
    status,
  });
}

export function fail(
  c: Context<GatewayBindings>,
  status: number,
  error: WebApiError,
): Response {
  const envelope: WebApiEnvelope<never> = {
    ok: false,
    error,
    requestId: requestId(c),
  };

  return Response.json(envelope, {
    status,
  });
}
