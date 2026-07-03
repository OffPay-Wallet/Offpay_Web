import type { SolanaCluster, WebSession, WebSessionVerification } from "./types";

type SessionStorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

type GatewaySessionStorageKey = {
  gatewayOrigin: string;
  cluster: SolanaCluster;
  walletAddress: string;
};

type StoredGatewaySession = {
  version: 1;
  session: WebSession;
  sessionToken: string;
};

const storageKeyPrefix = "offpay.web.gatewaySession.v1";

function browserSessionStorage(): SessionStorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function storageKey({ cluster, gatewayOrigin, walletAddress }: GatewaySessionStorageKey): string {
  return [
    storageKeyPrefix,
    encodeURIComponent(gatewayOrigin),
    cluster,
    walletAddress,
  ].join(":");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoredGatewaySession(value: unknown): value is StoredGatewaySession {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.sessionToken === "string" &&
    value.sessionToken.length > 0 &&
    isRecord(value.session) &&
    typeof value.session.id === "string" &&
    typeof value.session.expiresAt === "string" &&
    isRecord(value.session.identity) &&
    typeof value.session.identity.address === "string" &&
    typeof value.session.identity.cluster === "string"
  );
}

function matchesStorageKey(
  stored: StoredGatewaySession,
  { cluster, walletAddress }: GatewaySessionStorageKey,
): boolean {
  return (
    stored.session.identity.address === walletAddress &&
    stored.session.identity.cluster === cluster
  );
}

function isExpired(session: WebSession, now: Date): boolean {
  return new Date(session.expiresAt).getTime() <= now.getTime();
}

export function readStoredGatewaySession(
  key: GatewaySessionStorageKey,
  {
    now = new Date(),
    storage = browserSessionStorage(),
  }: {
    now?: Date;
    storage?: SessionStorageLike | null;
  } = {},
): WebSessionVerification | null {
  if (!storage) {
    return null;
  }

  const itemKey = storageKey(key);
  const raw = storage.getItem(itemKey);

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isStoredGatewaySession(parsed) || !matchesStorageKey(parsed, key)) {
      storage.removeItem(itemKey);
      return null;
    }

    if (isExpired(parsed.session, now)) {
      storage.removeItem(itemKey);
      return null;
    }

    return {
      session: parsed.session,
      sessionToken: parsed.sessionToken,
    };
  } catch {
    storage.removeItem(itemKey);
    return null;
  }
}

export function writeStoredGatewaySession(
  key: GatewaySessionStorageKey,
  verification: WebSessionVerification,
  {
    storage = browserSessionStorage(),
  }: {
    storage?: SessionStorageLike | null;
  } = {},
): void {
  if (!storage || !matchesStorageKey({ version: 1, ...verification }, key)) {
    return;
  }

  storage.setItem(
    storageKey(key),
    JSON.stringify({
      version: 1,
      session: verification.session,
      sessionToken: verification.sessionToken,
    } satisfies StoredGatewaySession),
  );
}

export function clearStoredGatewaySession(
  key: GatewaySessionStorageKey,
  {
    storage = browserSessionStorage(),
  }: {
    storage?: SessionStorageLike | null;
  } = {},
): void {
  storage?.removeItem(storageKey(key));
}
