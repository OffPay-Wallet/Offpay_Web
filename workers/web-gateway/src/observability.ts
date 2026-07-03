import type { Context } from "hono";

import type { GatewayBindings, GatewayEnv } from "./types";

type DebugFields = Record<string, unknown>;

const debugEnabledValues = new Set(["1", "true", "yes", "on", "debug", "verbose"]);
const sensitiveKeyPattern = /authorization|cookie|message|rpcUrl|secret|signature|token/i;
const privateIdentifierKeyPattern = /address|wallet/i;
const requestIdPattern = /^[A-Za-z0-9._:-]{8,120}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeDebugValue(value: unknown, key = ""): unknown {
  if (sensitiveKeyPattern.test(key)) {
    return "[redacted]";
  }

  if (typeof value === "string" && privateIdentifierKeyPattern.test(key)) {
    return redactIdentifier(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeDebugValue(entry));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeDebugValue(entryValue, entryKey),
      ]),
    );
  }

  return value;
}

function sanitizeDebugFields(fields?: DebugFields): DebugFields {
  if (!fields) {
    return {};
  }

  return sanitizeDebugValue(fields) as DebugFields;
}

function requestPath(c: Context<GatewayBindings>): string {
  return new URL(c.req.url).pathname;
}

function emitGatewayLog(
  c: Context<GatewayBindings>,
  method: "log" | "warn",
  event: string,
  fields?: DebugFields,
) {
  if (!isDebugLoggingEnabled(c.env)) {
    return;
  }

  console[method]("[offpay-web-gateway]", {
    event,
    method: c.req.method,
    path: requestPath(c),
    requestId: c.get("requestId"),
    ...sanitizeDebugFields(fields),
  });
}

export function isDebugLoggingEnabled(env: GatewayEnv): boolean {
  const configured = env.OFFPAY_DEBUG_LOGS?.trim().toLowerCase();

  return configured ? debugEnabledValues.has(configured) : false;
}

export function readClientRequestId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed || !requestIdPattern.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

export function nowMs(): number {
  return performance.now();
}

export function durationSince(startedAtMs: number): number {
  return Math.max(0, nowMs() - startedAtMs);
}

export function roundedDurationMs(durationMs: number): number {
  return Number(durationMs.toFixed(1));
}

export function redactIdentifier(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function formatServerTimingMetric(metric: string, durationMs: number): string {
  const safeMetric = metric.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64) || "metric";

  return `${safeMetric};dur=${roundedDurationMs(durationMs).toFixed(1)}`;
}

export function appendServerTimingHeader(
  headers: Headers,
  metric: string,
  durationMs: number,
) {
  const value = formatServerTimingMetric(metric, durationMs);
  const existing = headers.get("server-timing");

  headers.set("server-timing", existing ? `${existing}, ${value}` : value);
}

export function appendServerTiming(
  c: Context<GatewayBindings>,
  metric: string,
  durationMs: number,
) {
  const value = formatServerTimingMetric(metric, durationMs);
  const existing = c.res.headers.get("server-timing");

  c.header("server-timing", existing ? `${existing}, ${value}` : value);
}

export function gatewayDebugLog(
  c: Context<GatewayBindings>,
  event: string,
  fields?: DebugFields,
) {
  emitGatewayLog(c, "log", event, fields);
}

export function gatewayWarnLog(
  c: Context<GatewayBindings>,
  event: string,
  fields?: DebugFields,
) {
  emitGatewayLog(c, "warn", event, fields);
}
