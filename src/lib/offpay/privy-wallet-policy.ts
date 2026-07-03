import type { WebWalletCustody } from "./types";

type LinkedAccountLike = Record<string, unknown>;

export type WalletSelectionKey = `${WebWalletCustody}:${string}`;

function isRecord(value: unknown): value is LinkedAccountLike {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function linkedAccountsForUser(user: unknown): unknown[] {
  if (!isRecord(user) || !Array.isArray(user.linkedAccounts)) {
    return [];
  }

  return user.linkedAccounts;
}

function latestVerifiedAtMs(account: unknown): number {
  if (!isRecord(account)) {
    return Number.NEGATIVE_INFINITY;
  }

  const value = account.latestVerifiedAt;

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
  }

  return Number.NEGATIVE_INFINITY;
}

function isPrivyWalletClientType(walletClientType: unknown): boolean {
  return walletClientType === "privy" || walletClientType === "privy-v2";
}

function walletAddressForAccount(account: unknown): string | null {
  if (!isRecord(account) || typeof account.address !== "string") {
    return null;
  }

  const address = account.address.trim();
  return address.length > 0 ? address : null;
}

export function isLinkedPrivySolanaWallet(account: unknown): boolean {
  return (
    isRecord(account) &&
    account.type === "wallet" &&
    account.chainType === "solana" &&
    isPrivyWalletClientType(account.walletClientType)
  );
}

export function isLinkedExternalSolanaWallet(account: unknown): boolean {
  return (
    isRecord(account) &&
    account.type === "wallet" &&
    account.chainType === "solana" &&
    !isPrivyWalletClientType(account.walletClientType)
  );
}

export function linkedSolanaWalletAddressesForUser(
  user: unknown,
  custody?: WebWalletCustody,
): string[] {
  const addresses = new Set<string>();

  for (const account of linkedAccountsForUser(user)) {
    const isMatchingWallet =
      custody === "privy-solana"
        ? isLinkedPrivySolanaWallet(account)
        : custody === "external-solana"
          ? isLinkedExternalSolanaWallet(account)
          : isLinkedPrivySolanaWallet(account) || isLinkedExternalSolanaWallet(account);

    const address = isMatchingWallet ? walletAddressForAccount(account) : null;

    if (address) {
      addresses.add(address);
    }
  }

  return [...addresses];
}

export function hasLinkedPrivySolanaWallet(user: unknown): boolean {
  return linkedAccountsForUser(user).some(isLinkedPrivySolanaWallet);
}

export function hasLinkedExternalSolanaWallet(user: unknown): boolean {
  return linkedAccountsForUser(user).some(isLinkedExternalSolanaWallet);
}

export function getLatestVerifiedAccount(user: unknown): unknown | null {
  let latestAccount: unknown | null = null;
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const account of linkedAccountsForUser(user)) {
    const timestamp = latestVerifiedAtMs(account);

    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latestAccount = account;
    }
  }

  return latestAccount;
}

export function shouldCreateSolanaEmbeddedWalletOnLogin({ user }: { user: unknown }): boolean {
  if (hasLinkedPrivySolanaWallet(user)) {
    return false;
  }

  return !isLinkedExternalSolanaWallet(getLatestVerifiedAccount(user));
}

export function preferredWalletCustodyForUser(user: unknown): WebWalletCustody | undefined {
  const latestAccount = getLatestVerifiedAccount(user);

  if (isLinkedExternalSolanaWallet(latestAccount)) {
    return "external-solana";
  }

  if (hasLinkedPrivySolanaWallet(user)) {
    return "privy-solana";
  }

  if (latestAccount && !isLinkedExternalSolanaWallet(latestAccount)) {
    return undefined;
  }

  return hasLinkedExternalSolanaWallet(user) ? "external-solana" : undefined;
}

export function walletSelectionKey({
  address,
  custody,
}: {
  address: string;
  custody: WebWalletCustody;
}): WalletSelectionKey {
  return `${custody}:${address}`;
}
