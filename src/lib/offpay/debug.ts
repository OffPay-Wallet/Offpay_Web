import { isOffpayDebugEnabled } from "./public-config";

type DebugFields = Record<string, unknown>;

const sensitiveKeyPattern = /authorization|cookie|message|secret|signature|token/i;
const privateIdentifierKeyPattern = /address|wallet/i;

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

function sanitizeDebugFields(fields?: DebugFields): DebugFields | undefined {
  if (!fields) {
    return undefined;
  }

  return sanitizeDebugValue(fields) as DebugFields;
}

function emitDebugLog(
  method: "debug" | "error" | "info" | "warn",
  event: string,
  fields?: DebugFields,
) {
  if (!isOffpayDebugEnabled()) {
    return;
  }

  console[method]("[offpay-web]", event, sanitizeDebugFields(fields) ?? {});
}

export function debugLog(event: string, fields?: DebugFields) {
  emitDebugLog("info", event, fields);
}

export function debugWarn(event: string, fields?: DebugFields) {
  emitDebugLog("warn", event, fields);
}

export function debugError(event: string, fields?: DebugFields) {
  emitDebugLog("error", event, fields);
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

export function offpayPerformanceNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function markOffpayPerformance(name: string) {
  if (!isOffpayDebugEnabled() || typeof performance === "undefined" || !performance.mark) {
    return;
  }

  performance.mark(`offpay:${name}`);
}

export function measureOffpayPerformance(name: string, startMark: string, endMark?: string) {
  if (!isOffpayDebugEnabled() || typeof performance === "undefined" || !performance.measure) {
    return;
  }

  try {
    performance.measure(
      `offpay:${name}`,
      `offpay:${startMark}`,
      endMark ? `offpay:${endMark}` : undefined,
    );
  } catch {
    debugWarn("perf.measure_failed", { name, startMark, endMark });
  }
}
