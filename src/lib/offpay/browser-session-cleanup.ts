import { gatewaySessionStorageKeyPrefix } from "./gateway-session-storage";

type WalletSessionStorage = Pick<Storage, "getItem" | "key" | "length" | "removeItem">;
type WalletIndexedDb = Pick<IDBFactory, "deleteDatabase">;

type ClearBrowserWalletSessionStateOptions = {
  privyAppId?: string;
  localStorage?: WalletSessionStorage | null;
  sessionStorage?: WalletSessionStorage | null;
  indexedDb?: WalletIndexedDb | null;
  indexedDbDeleteTimeoutMs?: number;
};

const walletConnectIndexedDbNames = ["WALLET_CONNECT_V2_INDEXED_DB"];
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
