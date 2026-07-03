import { describe, expect, it } from "vitest";

import { clearBrowserWalletSessionState } from "../../../src/lib/offpay/browser-session-cleanup";

class MemoryStorage implements Pick<Storage, "getItem" | "key" | "length" | "removeItem"> {
  private readonly values = new Map<string, string>();

  constructor(entries: Record<string, string>) {
    Object.entries(entries).forEach(([key, value]) => {
      this.values.set(key, value);
    });
  }

  get length(): number {
    return this.values.size;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  has(key: string): boolean {
    return this.values.has(key);
  }
}

function createIndexedDb() {
  const deletedDatabases: string[] = [];
  const indexedDb = {
    deleteDatabase(databaseName: string): IDBOpenDBRequest {
      deletedDatabases.push(databaseName);

      const request: Partial<IDBOpenDBRequest> = {};

      queueMicrotask(() => {
        request.onsuccess?.({ type: "success" } as Event);
      });

      return request as IDBOpenDBRequest;
    },
  } satisfies Pick<IDBFactory, "deleteDatabase">;

  return { deletedDatabases, indexedDb };
}

describe("browser wallet session cleanup", () => {
  it("clears Offpay gateway, Privy wallet, WalletConnect, and wallet-adapter traces", async () => {
    const localStorage = new MemoryStorage({
      "offpay.web.gatewaySession.v1:https%3A%2F%2Fgateway.example:solana:devnet:abc": "session",
      "privy:app-id:active-wallet-connection": "phantom:CY2",
      "privy:app-id:recent-login-chain-type": "solana",
      "privy:app-id:recent-login-method": "wallet",
      "privy:app-id:recent-login-wallet-client": "phantom",
      "privy:old-app-id:recent-login-method": "wallet",
      "theme": "dark",
      "walletName": "Phantom",
      "wc@2:client:0.3//session": "session",
      "wc_storage_version": "1",
    });
    const sessionStorage = new MemoryStorage({
      "WALLETCONNECT_DEEPLINK_CHOICE": "phantom",
      "unrelated-session-key": "keep",
    });

    await clearBrowserWalletSessionState({
      privyAppId: "app-id",
      localStorage,
      sessionStorage,
      indexedDb: null,
    });

    expect(localStorage.has("offpay.web.gatewaySession.v1:https%3A%2F%2Fgateway.example:solana:devnet:abc")).toBe(
      false,
    );
    expect(localStorage.has("privy:app-id:active-wallet-connection")).toBe(false);
    expect(localStorage.has("privy:app-id:recent-login-chain-type")).toBe(false);
    expect(localStorage.has("privy:app-id:recent-login-method")).toBe(false);
    expect(localStorage.has("privy:app-id:recent-login-wallet-client")).toBe(false);
    expect(localStorage.has("privy:old-app-id:recent-login-method")).toBe(false);
    expect(localStorage.has("walletName")).toBe(false);
    expect(localStorage.has("wc@2:client:0.3//session")).toBe(false);
    expect(localStorage.has("wc_storage_version")).toBe(false);
    expect(sessionStorage.has("WALLETCONNECT_DEEPLINK_CHOICE")).toBe(false);
    expect(localStorage.has("theme")).toBe(true);
    expect(sessionStorage.has("unrelated-session-key")).toBe(true);
  });

  it("keeps a non-wallet recent Privy login marker", async () => {
    const localStorage = new MemoryStorage({
      "privy:app-id:recent-login-method": "google_oauth",
    });

    await clearBrowserWalletSessionState({
      privyAppId: "app-id",
      localStorage,
      sessionStorage: null,
      indexedDb: null,
    });

    expect(localStorage.has("privy:app-id:recent-login-method")).toBe(true);
  });

  it("deletes WalletConnect indexedDB state", async () => {
    const { deletedDatabases, indexedDb } = createIndexedDb();

    await clearBrowserWalletSessionState({
      localStorage: null,
      sessionStorage: null,
      indexedDb,
    });

    expect(deletedDatabases).toContain("WALLET_CONNECT_V2_INDEXED_DB");
  });
});
