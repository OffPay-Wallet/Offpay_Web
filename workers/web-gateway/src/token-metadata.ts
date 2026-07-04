import type {
  SolanaCluster,
  WalletTokenBalance,
} from "../../../src/lib/offpay/types";
import {
  devnetStableLogoSources,
  mergeKnownTokenDisplayMetadata,
} from "./known-token-metadata";
import { configuredUrl, metadataRpcUrl, rpcRequest } from "./rpc-core";
import type { GatewayEnv } from "./types";

export const nativeSolMint = "So11111111111111111111111111111111111111112";

const dasSearchPageSize = 1000;
const maxDasSearchPages = 50;
const metadataBatchSize = 100;

export type TokenDisplayMetadata = Pick<
  WalletTokenBalance,
  "logo" | "name" | "spam" | "symbol" | "verified"
>;

export function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value != null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readNonnegativeInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function readAtomicAmount(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value).toString();
  }

  return null;
}

function atomicAmountToUiAmount(amount: string, decimals: number): number | null {
  const rawAmount = Number(amount);
  if (!Number.isFinite(rawAmount)) {
    return null;
  }

  const divisor = 10 ** decimals;
  return Number.isFinite(divisor) && divisor > 0 ? rawAmount / divisor : null;
}

function readChildRecord(
  parent: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  return parent ? readRecord(parent[key]) : null;
}

function readHttpsImageUrl(value: unknown): string | null {
  const rawValue = readString(value);
  if (!rawValue) return null;

  try {
    const url = new URL(rawValue);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function readDasImageFromFiles(files: unknown): string | null {
  if (!Array.isArray(files)) return null;

  for (const file of files) {
    const record = readRecord(file);
    if (!record) continue;

    const mime = readString(record.mime)?.toLowerCase();
    if (mime && !mime.startsWith("image/")) continue;

    const cdnUri = readHttpsImageUrl(record.cdn_uri);
    if (cdnUri) return cdnUri;

    const uri = readHttpsImageUrl(record.uri);
    if (uri) return uri;
  }

  return null;
}

function readDasImage(asset: Record<string, unknown>): string | null {
  const content = readChildRecord(asset, "content");
  const links = readChildRecord(content, "links");
  const metadata = readChildRecord(content, "metadata");
  const tokenInfo = readChildRecord(asset, "token_info");

  return (
    readHttpsImageUrl(links?.image) ??
    readDasImageFromFiles(content?.files) ??
    readHttpsImageUrl(metadata?.image) ??
    readHttpsImageUrl(tokenInfo?.logoURI) ??
    readHttpsImageUrl(tokenInfo?.logo_uri) ??
    readHttpsImageUrl(tokenInfo?.image) ??
    readHttpsImageUrl(asset.logo) ??
    readHttpsImageUrl(asset.logoURI)
  );
}

function readDasAssetMetadata(
  asset: Record<string, unknown>,
): TokenDisplayMetadata | null {
  const content = readChildRecord(asset, "content");
  const metadata = readChildRecord(content, "metadata");
  const tokenInfo = readChildRecord(asset, "token_info");
  const name = readString(metadata?.name) ?? readString(tokenInfo?.name) ?? readString(asset.name);
  const symbol =
    readString(tokenInfo?.symbol) ?? readString(metadata?.symbol) ?? readString(asset.symbol);
  const logo = readDasImage(asset);
  const verified = readBoolean(tokenInfo?.verified) ?? readBoolean(asset.verified);
  const spam = readBoolean(tokenInfo?.spam) ?? readBoolean(asset.spam);

  if (!name && !symbol && !logo && verified === undefined && spam === undefined) {
    return null;
  }

  return {
    ...(name ? { name } : {}),
    ...(symbol ? { symbol } : {}),
    ...(logo ? { logo } : {}),
    ...(verified === undefined ? {} : { verified }),
    ...(spam === undefined ? {} : { spam }),
  };
}

export function readDasItems(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const record = readRecord(item);
      return record ? [record] : [];
    });
  }

  const result = readRecord(value);
  const items = result ? result.items : null;

  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((item) => {
    const record = readRecord(item);
    return record ? [record] : [];
  });
}

function readDasTotal(value: unknown): number | null {
  const result = readRecord(value);
  const total = result?.total;

  return typeof total === "number" && Number.isFinite(total) && total >= 0
    ? total
    : null;
}

function dasFungibleAssetToBalance(asset: Record<string, unknown>): WalletTokenBalance | null {
  const mint = readString(asset.id);
  const tokenInfo = readChildRecord(asset, "token_info");
  const amount = readAtomicAmount(tokenInfo?.balance);
  const decimals = readNonnegativeInteger(tokenInfo?.decimals);

  if (!mint || amount == null || decimals == null) {
    return null;
  }

  const uiAmount = atomicAmountToUiAmount(amount, decimals);
  const metadata = readDasAssetMetadata(asset);
  const programId = readString(tokenInfo?.token_program);

  return {
    mint,
    amount,
    decimals,
    uiAmount,
    uiAmountString: uiAmount == null ? amount : uiAmount.toString(),
    ...(programId ? { programId } : {}),
    ...(metadata ?? {}),
  };
}

export async function fetchFungibleAssetsByOwner(
  url: string,
  address: string,
): Promise<WalletTokenBalance[] | null> {
  try {
    const items: Record<string, unknown>[] = [];
    let page = 1;
    let total: number | null = null;

    while (page <= maxDasSearchPages) {
      const rawResult = await rpcRequest(url, "searchAssets", {
        ownerAddress: address,
        tokenType: "fungible",
        page,
        limit: dasSearchPageSize,
      });
      const pageItems = readDasItems(rawResult);

      items.push(...pageItems);
      total ??= readDasTotal(rawResult);

      if (pageItems.length === 0 || pageItems.length < dasSearchPageSize) {
        break;
      }

      if (total != null && items.length >= total) {
        break;
      }

      page += 1;
    }

    return items
      .map(dasFungibleAssetToBalance)
      .filter((balance): balance is WalletTokenBalance => balance != null);
  } catch {
    return null;
  }
}

export async function fetchTokenDisplayMetadataBatch(
  url: string,
  mints: readonly string[],
): Promise<ReadonlyMap<string, TokenDisplayMetadata>> {
  const uniqueMints = Array.from(
    new Set(
      mints.map((mint) => mint.trim()).filter((mint) => mint.length > 0),
    ),
  );

  if (uniqueMints.length === 0) {
    return new Map();
  }

  const byMint = new Map<string, TokenDisplayMetadata>();

  try {
    for (let index = 0; index < uniqueMints.length; index += metadataBatchSize) {
      const ids = uniqueMints.slice(index, index + metadataBatchSize);
      const rawResult = await rpcRequest(url, "getAssetBatch", { ids });
      const items = Array.isArray(rawResult) ? rawResult : [];

      items.forEach((item, itemIndex) => {
        const asset = readRecord(item);
        if (!asset) return;

        const mint = readString(asset.id) ?? ids[itemIndex];
        if (!mint) return;

        const metadata = readDasAssetMetadata(asset);
        if (metadata) {
          byMint.set(mint, metadata);
        }
      });
    }

    return byMint;
  } catch {
    return new Map();
  }
}

export async function fetchTokenDisplayMetadataForCluster({
  cluster,
  env,
  mints,
}: {
  cluster: SolanaCluster;
  env: GatewayEnv;
  mints: readonly string[];
}): Promise<ReadonlyMap<string, TokenDisplayMetadata>> {
  const url = metadataRpcUrl(env, cluster);
  const metadata = new Map(
    url ? await fetchTokenDisplayMetadataBatch(url, mints) : [],
  );

  if (cluster === "solana:devnet") {
    const pending = devnetStableLogoSources(env).filter(
      (pair) => mints.includes(pair.devnetMint) && !metadata.get(pair.devnetMint)?.logo,
    );
    const mainnetUrl = configuredUrl(env.HELIUS_MAINNET_RPC_URL);
    if (pending.length > 0 && mainnetUrl) {
      const mainnetMints = Array.from(new Set(pending.map((p) => p.mainnetMint)));
      const mainnetMetadata = await fetchTokenDisplayMetadataBatch(mainnetUrl, mainnetMints);
      for (const { devnetMint, mainnetMint } of pending) {
        const logo = mainnetMetadata.get(mainnetMint)?.logo;
        if (logo) metadata.set(devnetMint, { ...(metadata.get(devnetMint) ?? {}), logo });
      }
    }
  }

  return mergeKnownTokenDisplayMetadata({ cluster, env, metadata, mints });
}

export async function enrichTokenBalancesWithMetadata(
  url: string,
  balances: readonly WalletTokenBalance[],
): Promise<WalletTokenBalance[]> {
  if (balances.length === 0) {
    return [...balances];
  }

  const metadataByMint = await fetchTokenDisplayMetadataBatch(
    url,
    balances.map((balance) => balance.mint),
  );

  if (metadataByMint.size === 0) {
    return [...balances];
  }

  return balances.map((balance) => {
    const metadata = metadataByMint.get(balance.mint);
    return metadata ? { ...balance, ...metadata } : balance;
  });
}

export async function applyDevnetUsdcLogoFromMainnet({
  cluster,
  env,
  tokens,
}: {
  cluster: SolanaCluster;
  env: GatewayEnv;
  tokens: WalletTokenBalance[];
}): Promise<WalletTokenBalance[]> {
  if (cluster !== "solana:devnet") return tokens;
  const pending = devnetStableLogoSources(env).filter((pair) =>
    tokens.some((t) => t.mint === pair.devnetMint && !t.logo),
  );
  if (pending.length === 0) return tokens;
  const mainnetUrl = configuredUrl(env.HELIUS_MAINNET_RPC_URL);
  if (!mainnetUrl) return tokens;
  const mainnetMints = Array.from(new Set(pending.map((p) => p.mainnetMint)));
  const mainnetMetadata = await fetchTokenDisplayMetadataBatch(mainnetUrl, mainnetMints);
  const logoByMint = new Map<string, string>();
  for (const { devnetMint, mainnetMint } of pending) {
    const logo = mainnetMetadata.get(mainnetMint)?.logo;
    if (logo) logoByMint.set(devnetMint, logo);
  }
  if (logoByMint.size === 0) return tokens;
  return tokens.map((token) => {
    const logo = !token.logo ? logoByMint.get(token.mint) : undefined;
    return logo ? { ...token, logo } : token;
  });
}
