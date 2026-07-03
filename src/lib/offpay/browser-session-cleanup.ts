import { gatewaySessionStorageKeyPrefix } from "./gateway-session-storage";

type WalletSessionStorage = Pick<Storage, "getItem" | "key" | "length" | "removeItem">;
type WalletIndexedDb = Pick<IDBFactory, "deleteDatabase">;

type ClearPrivyAuthSessionStateResult = {
  activeUserIds: string[];
  oauthCallbackDetected: boolean;
  removedCookieCount: number;
  removedStorageKeyCount: number;
};

type ClearBrowserWalletSessionStateOptions = {
  privyAppId?: string;
  localStorage?: WalletSessionStorage | null;
  sessionStorage?: WalletSessionStorage | null;
  indexedDb?: WalletIndexedDb | null;
  indexedDbDeleteTimeoutMs?: number;
};

const walletConnectIndexedDbNames = ["WALLET_CONNECT_V2_INDEXED_DB"];
const privyActiveUserStorageKey = "privy:active-user";
const privySavedUsersStorageKey = "privy:saved-users";
const privyAuthStorageKeys = [
  "privy:token",
  "privy:pat",
  "privy:refresh_token",
  "privy:id-token",
  privyActiveUserStorageKey,
  privySavedUsersStorageKey,
] as const;
const privyAuthStorageSuffixPattern = /^privy:.+:(?:token|pat|refresh_token|id-token)$/;
const privyAuthCookieNames = [
  "privy-token",
  "privy-refresh-token",
  "privy-id-token",
  "privy-session",
] as const;
const privyUserAuthCookiePattern = /^privy-.+-(?:token|refresh-token|id-token|session)$/;
const privyWalletStorageSuffixes = [
  ":active-wallet-connection",
  ":recent-login-wallet-client",
  ":recent-login-chain-type",
] as const;
const knownExternalWalletFragments = [
  "backpack",
  "jupiter",
  "phantom",
  "solflare",
  "wallet_connect",
  "walletconnect",
] as const;

function browserStorage(storageName: "localStorage" | "sessionStorage"): WalletSessionStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window[storageName];
  } catch {
    return null;
  }
}

function browserIndexedDb(): WalletIndexedDb | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.indexedDB ?? null;
  } catch {
    return null;
  }
}

function getStorageValue(storage: WalletSessionStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function collectStorageKeys(storage: WalletSessionStorage | null | undefined): string[] {
  if (!storage) {
    return [];
  }

  const keys: string[] = [];

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (key) {
        keys.push(key);
      }
    }
  } catch {
    return keys;
  }

  return keys;
}

function getBrowserSearch(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.search;
}

function hasPrivyOAuthCallback(search = getBrowserSearch()): boolean {
  const params = new URLSearchParams(search);

  return (
    params.has("privy_oauth_state") &&
    params.has("privy_oauth_provider") &&
    params.has("privy_oauth_code")
  );
}

function parseStoredString(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "string" && parsed.length > 0 ? parsed : null;
  } catch {
    return value.length > 0 ? value : null;
  }
}

function parseStoredStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      : [];
  } catch {
    return [];
  }
}

function collectPrivyActiveUserIds(storage: WalletSessionStorage | null | undefined): string[] {
  if (!storage) {
    return [];
  }

  const activeUserId = parseStoredString(getStorageValue(storage, privyActiveUserStorageKey));
  const savedUserIds = parseStoredStringArray(getStorageValue(storage, privySavedUsersStorageKey));

  return [...new Set([activeUserId, ...savedUserIds].filter((id): id is string => Boolean(id)))];
}

function isPrivyAuthStorageKey(key: string): boolean {
  return privyAuthStorageKeys.includes(key as (typeof privyAuthStorageKeys)[number]) ||
    privyAuthStorageSuffixPattern.test(key);
}

function clearPrivyAuthStorageKeys(storage: WalletSessionStorage | null | undefined): number {
  if (!storage) {
    return 0;
  }

  let removedCount = 0;

  for (const key of collectStorageKeys(storage)) {
    if (!isPrivyAuthStorageKey(key)) {
      continue;
    }

    try {
      storage.removeItem(key);
      removedCount += 1;
    } catch {
      // Storage can be unavailable in locked-down browser contexts.
    }
  }

  return removedCount;
}

function collectCookieNames(): string[] {
  if (typeof document === "undefined" || !document.cookie) {
    return [];
  }

  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((name): name is string => Boolean(name));
}

function expireCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
}

function clearPrivyAuthCookies(): number {
  if (typeof document === "undefined") {
    return 0;
  }

  let removedCount = 0;

  for (const name of collectCookieNames()) {
    if (
      !privyAuthCookieNames.includes(name as (typeof privyAuthCookieNames)[number]) &&
      !privyUserAuthCookiePattern.test(name)
    ) {
      continue;
    }

    expireCookie(name);
    removedCount += 1;
  }

  return removedCount;
}

function isWalletConnectStorageKey(key: string): boolean {
  const normalized = key.toLowerCase();

  return (
    normalized === "wc_storage_version" ||
    normalized.includes("walletconnect") ||
    normalized.includes("wallet_connect") ||
    normalized.startsWith("wc@") ||
    normalized.startsWith("wc_")
  );
}

function hasKnownExternalWalletValue(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();

  return knownExternalWalletFragments.some((fragment) => normalized.includes(fragment));
}

function isWalletAdapterStorageKey(storage: WalletSessionStorage, key: string): boolean {
  const normalized = key.toLowerCase();

  return (
    (normalized === "walletname" ||
      normalized.includes("wallet-adapter") ||
      normalized.includes("wallet_adapter") ||
      normalized.includes("walletadapter")) &&
    hasKnownExternalWalletValue(getStorageValue(storage, key))
  );
}

function isPrivyWalletStorageKey(
  storage: WalletSessionStorage,
  key: string,
  privyAppId?: string,
): boolean {
  if (!key.startsWith("privy:")) {
    return false;
  }

  const isCurrentPrivyApp = privyAppId ? key.startsWith(`privy:${privyAppId}:`) : true;
  const isWalletLoginMethod =
    key.endsWith(":recent-login-method") &&
    getStorageValue(storage, key)?.toLowerCase() === "wallet";

  if (!isCurrentPrivyApp) {
    return privyWalletStorageSuffixes.some((suffix) => key.endsWith(suffix)) || isWalletLoginMethod;
  }

  if (privyWalletStorageSuffixes.some((suffix) => key.endsWith(suffix))) {
    return true;
  }

  return isWalletLoginMethod;
}

function shouldClearStorageKey(
  storage: WalletSessionStorage,
  key: string,
  privyAppId?: string,
): boolean {
  return (
    key.startsWith(gatewaySessionStorageKeyPrefix) ||
    isPrivyWalletStorageKey(storage, key, privyAppId) ||
    isWalletConnectStorageKey(key) ||
    isWalletAdapterStorageKey(storage, key)
  );
}

function clearStorageKeys(storage: WalletSessionStorage | null | undefined, privyAppId?: string) {
  if (!storage) {
    return;
  }

  for (const key of collectStorageKeys(storage)) {
    if (!shouldClearStorageKey(storage, key, privyAppId)) {
      continue;
    }

    try {
      storage.removeItem(key);
    } catch {
      // Storage can be unavailable in locked-down browser contexts.
    }
  }
}

function deleteIndexedDbDatabase(
  indexedDb: WalletIndexedDb,
  databaseName: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      resolve();
    };

    const timeout = setTimeout(finish, timeoutMs);

    try {
      const request = indexedDb.deleteDatabase(databaseName);

      request.onsuccess = () => finish();
      request.onerror = () => finish();
      request.onblocked = () => finish();
    } catch {
      finish();
    }
  });
}

async function clearWalletConnectIndexedDb(
  indexedDb: WalletIndexedDb | null | undefined,
  timeoutMs: number,
): Promise<void> {
  if (!indexedDb) {
    return;
  }

  await Promise.allSettled(
    walletConnectIndexedDbNames.map((databaseName) =>
      deleteIndexedDbDatabase(indexedDb, databaseName, timeoutMs),
    ),
  );
}

export async function clearBrowserWalletSessionState({
  privyAppId,
  localStorage = browserStorage("localStorage"),
  sessionStorage = browserStorage("sessionStorage"),
  indexedDb = browserIndexedDb(),
  indexedDbDeleteTimeoutMs = 600,
}: ClearBrowserWalletSessionStateOptions = {}): Promise<void> {
  clearStorageKeys(localStorage, privyAppId);
  clearStorageKeys(sessionStorage, privyAppId);
  await clearWalletConnectIndexedDb(indexedDb, indexedDbDeleteTimeoutMs);
}

export function clearPrivyAuthSessionStateForOAuthCallback({
  localStorage = browserStorage("localStorage"),
  sessionStorage = browserStorage("sessionStorage"),
  search = getBrowserSearch(),
}: {
  localStorage?: WalletSessionStorage | null;
  sessionStorage?: WalletSessionStorage | null;
  search?: string;
} = {}): ClearPrivyAuthSessionStateResult {
  const oauthCallbackDetected = hasPrivyOAuthCallback(search);
  const activeUserIds = [
    ...new Set([
      ...collectPrivyActiveUserIds(localStorage),
      ...collectPrivyActiveUserIds(sessionStorage),
    ]),
  ];

  if (!oauthCallbackDetected) {
    return {
      activeUserIds,
      oauthCallbackDetected,
      removedCookieCount: 0,
      removedStorageKeyCount: 0,
    };
  }

  return {
    activeUserIds,
    oauthCallbackDetected,
    removedCookieCount: clearPrivyAuthCookies(),
    removedStorageKeyCount:
      clearPrivyAuthStorageKeys(localStorage) + clearPrivyAuthStorageKeys(sessionStorage),
  };
}
