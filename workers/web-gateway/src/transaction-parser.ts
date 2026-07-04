import type { WalletTransactionAsset } from "../../../src/lib/offpay/types";
import { nativeSolMint, readRecord, readString } from "./token-metadata";

export const tokenProgramIds = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
] as const;

const systemProgramId = "11111111111111111111111111111111";
const solDecimals = 9;

type TokenSnapshot = {
  amount: bigint | null;
  decimals?: number;
  key: string;
  mint: string;
  order: number;
};

export type TransactionAssetCandidate = Pick<
  WalletTransactionAsset,
  "decimals" | "mint" | "rawAmountChange" | "uiAmountChange"
> & {
  order: number;
};

export function readInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export function readBigIntAmount(value: unknown): bigint | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return BigInt(value);
  }

  const amount = readString(value);
  if (!amount || !/^\d+$/.test(amount)) return null;

  try {
    return BigInt(amount);
  } catch {
    return null;
  }
}

function uiAmount(delta: bigint, decimals: number | undefined): number | null {
  if (decimals == null || decimals < 0 || decimals > 18) return null;

  const divisor = 10 ** decimals;
  if (!Number.isFinite(divisor) || divisor <= 0) return null;

  const value = Number(delta) / divisor;
  return Number.isFinite(value) ? value : null;
}

export function readAccountKeyAt(
  transaction: Record<string, unknown>,
  index: number,
): string | null {
  const tx = readRecord(transaction.transaction);
  const message = readRecord(tx?.message);
  const accountKeys = message?.accountKeys;

  if (!Array.isArray(accountKeys)) return null;

  const accountKey = accountKeys[index];
  if (typeof accountKey === "string") return accountKey;

  return readString(readRecord(accountKey)?.pubkey);
}

function readWalletAccountIndex(
  transaction: Record<string, unknown>,
  address: string,
): number {
  const tx = readRecord(transaction.transaction);
  const message = readRecord(tx?.message);
  const accountKeys = message?.accountKeys;

  if (!Array.isArray(accountKeys)) return -1;

  return accountKeys.findIndex((accountKey) => {
    if (typeof accountKey === "string") return accountKey === address;

    return readString(readRecord(accountKey)?.pubkey) === address;
  });
}

function readTokenSnapshots({
  address,
  key,
  ownedTokenAccounts,
  transaction,
}: {
  address: string;
  key: "postTokenBalances" | "preTokenBalances";
  ownedTokenAccounts: ReadonlyMap<string, string>;
  transaction: Record<string, unknown>;
}): TokenSnapshot[] {
  const meta = readRecord(transaction.meta);
  const balances = meta?.[key];

  if (!Array.isArray(balances)) return [];

  return balances.flatMap((balance, order) => {
    const record = readRecord(balance);
    const mint = readString(record?.mint);
    const owner = readString(record?.owner);
    const accountIndex = readInteger(record?.accountIndex);
    const account = accountIndex == null ? null : readAccountKeyAt(transaction, accountIndex);
    const tokenAmount = readRecord(record?.uiTokenAmount);
    const amount = readBigIntAmount(tokenAmount?.amount);
    const decimals = readInteger(tokenAmount?.decimals) ?? undefined;
    const isWalletOwned =
      owner === address ||
      account === address ||
      (account ? ownedTokenAccounts.get(account) === mint : false);

    if (!mint || !isWalletOwned) return [];

    return [
      {
        amount,
        key: `${mint}:${account ?? owner ?? accountIndex ?? order}`,
        mint,
        order,
        ...(decimals != null ? { decimals } : {}),
      },
    ];
  });
}

export function mergeTokenAssets(
  assets: TransactionAssetCandidate[],
): TransactionAssetCandidate[] {
  const byMint = new Map<
    string,
    { decimals?: number; delta: bigint | null; mint: string; order: number }
  >();

  for (const asset of assets) {
    const current = byMint.get(asset.mint);
    const decimals = current?.decimals ?? asset.decimals;
    const delta =
      asset.rawAmountChange == null ? null : BigInt(asset.rawAmountChange);
    const nextDelta =
      current?.delta == null || delta == null ? (current?.delta ?? delta) : current.delta + delta;

    byMint.set(asset.mint, {
      delta: nextDelta,
      mint: asset.mint,
      order: Math.min(current?.order ?? asset.order, asset.order),
      ...(decimals != null ? { decimals } : {}),
    });
  }

  return Array.from(byMint.values())
    .sort((a, b) => a.order - b.order)
    .map((asset) => ({
      mint: asset.mint,
      order: asset.order,
      ...(asset.decimals != null ? { decimals: asset.decimals } : {}),
      ...(asset.delta != null && asset.delta !== 0n
        ? {
            rawAmountChange: asset.delta.toString(),
            uiAmountChange: uiAmount(asset.delta, asset.decimals),
          }
        : {}),
    }));
}

export function pickTokenAssetCandidates({
  address,
  ownedTokenAccounts,
  transaction,
}: {
  address: string;
  ownedTokenAccounts: ReadonlyMap<string, string>;
  transaction: Record<string, unknown>;
}): TransactionAssetCandidate[] {
  const byKey = new Map<
    string,
    {
      decimals?: number;
      mint: string;
      order: number;
      post: bigint | null;
      pre: bigint | null;
    }
  >();

  for (const snapshot of readTokenSnapshots({
    address,
    key: "preTokenBalances",
    ownedTokenAccounts,
    transaction,
  })) {
    byKey.set(snapshot.key, {
      mint: snapshot.mint,
      order: snapshot.order,
      post: null,
      pre: snapshot.amount,
      ...(snapshot.decimals != null ? { decimals: snapshot.decimals } : {}),
    });
  }

  for (const snapshot of readTokenSnapshots({
    address,
    key: "postTokenBalances",
    ownedTokenAccounts,
    transaction,
  })) {
    const existing = byKey.get(snapshot.key);
    const decimals = existing?.decimals ?? snapshot.decimals;
    byKey.set(snapshot.key, {
      mint: snapshot.mint,
      order: existing?.order ?? snapshot.order,
      post: snapshot.amount,
      pre: existing?.pre ?? null,
      ...(decimals != null ? { decimals } : {}),
    });
  }

  const candidates = Array.from(byKey.values()).map((snapshot) => {
    const pre = snapshot.pre ?? 0n;
    const post = snapshot.post ?? 0n;
    const delta = post - pre;

    return {
      mint: snapshot.mint,
      order: snapshot.order,
      ...(snapshot.decimals != null ? { decimals: snapshot.decimals } : {}),
      ...(delta !== 0n
        ? {
            rawAmountChange: delta.toString(),
            uiAmountChange: uiAmount(delta, snapshot.decimals),
          }
        : {}),
    };
  });
  const changed = candidates.filter((candidate) => candidate.rawAmountChange != null);

  return mergeTokenAssets(changed.length > 0 ? changed : candidates);
}

export function collectInstructions(
  transaction: Record<string, unknown>,
): Record<string, unknown>[] {
  const tx = readRecord(transaction.transaction);
  const message = readRecord(tx?.message);
  const instructions = Array.isArray(message?.instructions) ? message.instructions : [];
  const meta = readRecord(transaction.meta);
  const innerGroups = Array.isArray(meta?.innerInstructions) ? meta.innerInstructions : [];
  const innerInstructions = innerGroups.flatMap((group) => {
    const record = readRecord(group);
    return Array.isArray(record?.instructions) ? record.instructions : [];
  });

  return [...instructions, ...innerInstructions].flatMap((instruction) => {
    const record = readRecord(instruction);
    return record ? [record] : [];
  });
}

function isWalletInstruction(
  info: Record<string, unknown>,
  address: string,
  ownedTokenAccounts: ReadonlyMap<string, string>,
): boolean {
  return [
    info.authority,
    info.destination,
    info.destinationOwner,
    info.owner,
    info.source,
    info.sourceOwner,
    info.wallet,
  ].some((value) => {
    const account = readString(value);
    return account === address || (account ? ownedTokenAccounts.has(account) : false);
  });
}

export function pickInstructionAssets({
  address,
  existingMints,
  ownedTokenAccounts,
  transaction,
}: {
  address: string;
  existingMints: ReadonlySet<string>;
  ownedTokenAccounts: ReadonlyMap<string, string>;
  transaction: Record<string, unknown>;
}): TransactionAssetCandidate[] {
  const assets: TransactionAssetCandidate[] = [];

  for (const [order, instruction] of collectInstructions(transaction).entries()) {
    const parsed = readRecord(instruction.parsed);
    const info = readRecord(parsed?.info);
    const mint = readString(info?.mint);

    if (
      mint &&
      !existingMints.has(mint) &&
      isWalletInstruction(info ?? {}, address, ownedTokenAccounts)
    ) {
      assets.push({ mint, order: 10_000 + order });
    }
  }

  return mergeTokenAssets(assets);
}

export function pickNativeSolAsset({
  address,
  transaction,
}: {
  address: string;
  transaction: Record<string, unknown>;
}): TransactionAssetCandidate | null {
  let transferDelta = 0n;

  for (const instruction of collectInstructions(transaction)) {
    const programId = readString(instruction.programId);
    const parsed = readRecord(instruction.parsed);
    const info = readRecord(parsed?.info);

    if (programId !== systemProgramId || readString(parsed?.type) !== "transfer") continue;

    const lamports = readBigIntAmount(info?.lamports);
    if (lamports == null || lamports <= 0n) continue;

    if (readString(info?.source) === address) transferDelta -= lamports;
    if (readString(info?.destination) === address) transferDelta += lamports;
  }

  if (transferDelta !== 0n) {
    return {
      mint: nativeSolMint,
      decimals: solDecimals,
      order: 50_000,
      rawAmountChange: transferDelta.toString(),
      uiAmountChange: uiAmount(transferDelta, solDecimals),
    };
  }

  const walletIndex = readWalletAccountIndex(transaction, address);
  if (walletIndex < 0) return null;

  const meta = readRecord(transaction.meta);
  const preBalances = meta?.preBalances;
  const postBalances = meta?.postBalances;

  if (!Array.isArray(preBalances) || !Array.isArray(postBalances)) return null;

  const pre = readInteger(preBalances[walletIndex]);
  const post = readInteger(postBalances[walletIndex]);
  if (pre == null || post == null || pre === post) return null;

  let delta = BigInt(post) - BigInt(pre);
  const fee = readInteger(meta?.fee);
  if (delta < 0n && walletIndex === 0 && fee != null) {
    delta += BigInt(fee);
  }
  if (delta === 0n) return null;

  return {
    mint: nativeSolMint,
    decimals: solDecimals,
    order: 50_000,
    rawAmountChange: delta.toString(),
    uiAmountChange: uiAmount(delta, solDecimals),
  };
}
