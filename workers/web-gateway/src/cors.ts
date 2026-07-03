import type { GatewayEnv } from "./types";

function isLocalhostDisabled(env: GatewayEnv): boolean {
  const configured = env.OFFPAY_ALLOW_LOCALHOST_ORIGINS?.trim().toLowerCase();

  return configured === "0" || configured === "false" || configured === "no" || configured === "off";
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function normalizeOrigin(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    return url.origin;
  } catch {
    return undefined;
  }
}

export function isLocalDevelopmentOrigin(
  env: GatewayEnv,
  origin: string | undefined,
): boolean {
  if (isLocalhostDisabled(env)) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return false;
  }

  const url = new URL(normalizedOrigin);

  return url.protocol === "http:" && isLoopbackHostname(url.hostname);
}

export function parseAllowedOrigins(env: GatewayEnv): Set<string> {
  const configured = env.OFFPAY_ALLOWED_WEB_ORIGINS ?? "";

  return new Set(
    configured
      .split(",")
      .map((origin) => normalizeOrigin(origin))
      .filter((origin): origin is string => Boolean(origin)),
  );
}

export function isAllowedOrigin(env: GatewayEnv, origin: string | undefined): origin is string {
  const normalizedOrigin = normalizeOrigin(origin);

  return Boolean(
    normalizedOrigin &&
      (parseAllowedOrigins(env).has(normalizedOrigin) ||
        isLocalDevelopmentOrigin(env, normalizedOrigin)),
  );
}
