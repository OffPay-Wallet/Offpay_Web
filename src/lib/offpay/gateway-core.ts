import type { WebApiEnvelope } from "./types";
import {
  debugError,
  debugLog,
  debugWarn,
  markOffpayPerformance,
  measureOffpayPerformance,
  offpayPerformanceNow,
} from "./debug";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGatewayEnvelope<T>(payload: unknown): payload is WebApiEnvelope<T> {
  if (!isRecord(payload) || typeof payload.ok !== "boolean") {
    return false;
  }

  if (typeof payload.requestId !== "string") {
    return false;
  }

  if (payload.ok) {
    return "data" in payload;
  }

  return (
    isRecord(payload.error) &&
    typeof payload.error.code === "string" &&
    typeof payload.error.message === "string"
  );
}

function createClientRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

async function readEnvelope<T>(response: Response): Promise<WebApiEnvelope<T>> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      requestId: response.headers.get("x-offpay-request-id") ?? "missing",
      error: {
        code: "invalid_gateway_json",
        message: `Gateway returned ${response.status} without a valid JSON envelope.`,
      },
    };
  }

  if (!isGatewayEnvelope<T>(payload)) {
    return {
      ok: false,
      requestId: response.headers.get("x-offpay-request-id") ?? "missing",
      error: {
        code: "invalid_gateway_envelope",
        message: "Gateway returned an unexpected response envelope.",
      },
    };
  }

  if (!response.ok && payload.ok) {
    return {
      ok: false,
      requestId: payload.requestId,
      error: {
        code: "http_error",
        message: `Gateway returned ${response.status}.`,
      },
    };
  }

  return payload;
}

export async function requestGateway<T>({
  context,
  gatewayOrigin,
  init,
  label,
  path,
}: {
  context?: Record<string, unknown>;
  gatewayOrigin: string;
  init: RequestInit;
  label: string;
  path: string;
}): Promise<WebApiEnvelope<T>> {
  const requestId = createClientRequestId();
  const target = new URL(path, gatewayOrigin);
  const headers = new Headers(init.headers);
  const method = init.method ?? "GET";
  const startedAt = offpayPerformanceNow();
  const markName = `api:${label}:${requestId}`;

  headers.set("x-offpay-request-id", requestId);
  markOffpayPerformance(`${markName}:start`);
  debugLog("api.request", {
    label,
    method,
    path: target.pathname,
    requestId,
    ...context,
  });

  try {
    const response = await fetch(target, {
      ...init,
      headers,
    });
    const envelope = await readEnvelope<T>(response);
    const durationMs = offpayPerformanceNow() - startedAt;

    markOffpayPerformance(`${markName}:end`);
    measureOffpayPerformance(markName, `${markName}:start`, `${markName}:end`);

    const event = envelope.ok ? "api.response" : "api.error";
    const fields = {
      label,
      method,
      ok: envelope.ok,
      path: target.pathname,
      requestId: envelope.requestId,
      status: response.status,
      durationMs: Number(durationMs.toFixed(1)),
      serverTiming: response.headers.get("server-timing"),
      ...(!envelope.ok ? { error: envelope.error } : {}),
      ...context,
    };

    if (envelope.ok) {
      debugLog(event, fields);
    } else {
      debugWarn(event, fields);
    }

    return envelope;
  } catch (error) {
    const durationMs = offpayPerformanceNow() - startedAt;

    debugError("api.network_error", {
      label,
      method,
      path: target.pathname,
      requestId,
      durationMs: Number(durationMs.toFixed(1)),
      error: error instanceof Error ? error.message : "Unknown network error",
      ...context,
    });

    throw error;
  }
}
