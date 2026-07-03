import { z } from "zod";

import type {
  SolanaCluster,
  WalletPortfolio,
  WalletTokenBalance,
} from "../../../src/lib/offpay/types";
import type { GatewayEnv } from "./types";

const lamportsPerSol = 1_000_000_000;
const nativeSolMint = "So11111111111111111111111111111111111111112";
const splTokenProgramId = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const token2022ProgramId = "TokenzQdBNbLqP5VEhdkAS6EPF8MZCShU6xm5Y5kKbVQ";
// Devnet USDC has no on-chain image via devnet DAS, so its logo is sourced
// from the canonical mainnet USDC asset metadata (API data, no local asset).
const devnetUsdcMint = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const mainnetUsdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const rpcEnvelopeSchema = z.object({
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number().optional(),
      message: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

const balanceResultSchema = z.object({
  value: z.number().int().nonnegative(),
});

const tokenAccountSchema = z.object({
  account: z.object({
    owner: z.string().optional(),
    data: z.object({
      parsed: z.object({
        info: z.object({
          mint: z.string().min(1),
          tokenAmount: z.object({
            amount: z.string().min(1),
            decimals: z.number().int().min(0),
            uiAmount: z.number().nullable().optional(),
            uiAmountString: z.string().optional(),
          }),
        }),
      }),
    }),
  }),
});

const tokenAccountsResultSchema = z.object({
  value: z.array(tokenAccountSchema),
});

type RpcProviderConfig = {
  urls: string[];
  expectedKeys: string[];
};

type TokenDisplayMetadata = Pick<
  WalletTokenBalance,
  "logo" | "name" | "spam" | "symbol" | "verified"
>;

export class RpcBalanceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor({
    code,
    details,
    message,
    status,
  }: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, unknown>;
  }) {
    super(message);
    this.name = "RpcBalanceError";
    this.code = code;
    this.status = status;

    if (details) {
      this.details = details;
    }
  }
}

function configuredUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed && /^https:\/\//i.test(trimmed) ? trimmed : null;
}

export function rpcProviderConfig(env: GatewayEnv, cluster: SolanaCluster): RpcProviderConfig {
  if (cluster === "solana:devnet") {
    const expectedKeys = [
      "HELIUS_DEVNET_RPC_URL",
      "ALCHEMY_DEVNET_RPC_URL",
      "ALCHEMY_DEVNET_FALLBACK_RPC_URL",
    ];
    return {
      expectedKeys,
      urls: [
        configuredUrl(env.HELIUS_DEVNET_RPC_URL),
        configuredUrl(env.ALCHEMY_DEVNET_RPC_URL),
        configuredUrl(env.ALCHEMY_DEVNET_FALLBACK_RPC_URL),
      ].filter((url): url is string => Boolean(url)),
    };
  }

  if (cluster === "solana:mainnet") {
    const expectedKeys = [
      "HELIUS_MAINNET_RPC_URL",
      "ALCHEMY_MAINNET_RPC_URL",
      "ALCHEMY_MAINNET_FALLBACK_RPC_URL",
    ];
    return {
      expectedKeys,
      urls: [
        configuredUrl(env.HELIUS_MAINNET_RPC_URL),
        configuredUrl(env.ALCHEMY_MAINNET_RPC_URL),
        configuredUrl(env.ALCHEMY_MAINNET_FALLBACK_RPC_URL),
      ].filter((url): url is string => Boolean(url)),
    };
  }

  return {
    expectedKeys: [],
    urls: [],
  };
}

function metadataRpcUrl(env: GatewayEnv, cluster: SolanaCluster): string | null {
  if (cluster === "solana:devnet") {
    return configuredUrl(env.HELIUS_DEVNET_RPC_URL);
  }

  if (cluster === "solana:mainnet") {
    return configuredUrl(env.HELIUS_MAINNET_RPC_URL);
  }

  return null;
}

export async function rpcRequest(url: string, method: string, params: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new RpcBalanceError({
      code: "rpc_http_error",
      message: `Solana RPC returned HTTP ${response.status}.`,
      status: 502,
    });
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new RpcBalanceError({
      code: "rpc_invalid_json",
      message: "Solana RPC returned invalid JSON.",
      status: 502,
    });
  }

  const envelope = rpcEnvelopeSchema.safeParse(payload);

  if (!envelope.success) {
    throw new RpcBalanceError({
      code: "rpc_invalid_response",
      message: "Solana RPC returned an unexpected response envelope.",
      status: 502,
    });
  }

  if (envelope.data.error) {
    throw new RpcBalanceError({
      code: "rpc_error",
      message: envelope.data.error.message ?? `${method} failed at the Solana RPC provider.`,
      status: 502,
    });
  }

  return envelope.data.result;
}

function tokenAccountToBalance(account: z.infer<typeof tokenAccountSchema>): WalletTokenBalance {
  const tokenAmount = account.account.data.parsed.info.tokenAmount;

  return {
    mint: account.account.data.parsed.info.mint,
    amount: tokenAmount.amount,
    decimals: tokenAmount.decimals,
    uiAmount: tokenAmount.uiAmount ?? null,
    uiAmountString: tokenAmount.uiAmountString ?? tokenAmount.amount,
    ...(account.account.owner ? { programId: account.account.owner } : {}),
  };
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value != null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
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

function readDasItems(value: unknown): Record<string, unknown>[] {
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

async function fetchFungibleAssetsByOwner(
  url: string,
  address: string,
): Promise<WalletTokenBalance[] | null> {
  try {
    const rawResult = await rpcRequest(url, "searchAssets", {
      ownerAddress: address,
      tokenType: "fungible",
      page: 1,
      limit: 1000,
    });

    return readDasItems(rawResult)
      .map(dasFungibleAssetToBalance)
      .filter((balance): balance is WalletTokenBalance => balance != null);
  } catch {
    return null;
  }
}

function mergeDasAndRpcTokenBalances({
  dasBalances,
  rpcBalances,
}: {
  dasBalances: readonly WalletTokenBalance[];
  rpcBalances: readonly WalletTokenBalance[];
}): WalletTokenBalance[] {
  if (dasBalances.length === 0) {
    return [...rpcBalances];
  }

  const dasByMint = new Map(dasBalances.map((balance) => [balance.mint, balance]));
  const merged = [...dasBalances];

  for (const balance of rpcBalances) {
    if (!dasByMint.has(balance.mint)) {
      merged.push(balance);
    }
  }

  return merged;
}

async function fetchTokenDisplayMetadataBatch(
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

  try {
    const rawResult = await rpcRequest(url, "getAssetBatch", { ids: uniqueMints });
    const items = Array.isArray(rawResult) ? rawResult : [];
    const byMint = new Map<string, TokenDisplayMetadata>();

    items.forEach((item, index) => {
      const asset = readRecord(item);
      if (!asset) return;

      const mint = readString(asset.id) ?? uniqueMints[index];
      if (!mint) return;

      const metadata = readDasAssetMetadata(asset);
      if (metadata) {
        byMint.set(mint, metadata);
      }
    });

    return byMint;
  } catch {
    return new Map();
  }
}

async function enrichTokenBalancesWithMetadata(
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

async function fetchTokenAccounts(url: string, address: string): Promise<WalletTokenBalance[]> {
  const balances: WalletTokenBalance[] = [];

  for (const programId of [splTokenProgramId, token2022ProgramId]) {
    try {
      const rawResult = await rpcRequest(url, "getTokenAccountsByOwner", [
        address,
        { programId },
        { encoding: "jsonParsed" },
      ]);
      const parsed = tokenAccountsResultSchema.parse(rawResult);

      balances.push(...parsed.value.map((account) => tokenAccountToBalance(account)));
    } catch {
      // Token account reads should not block showing the native SOL balance.
    }
  }

  return balances;
}

async function applyDevnetUsdcLogoFromMainnet({
  cluster,
  env,
  tokens,
}: {
  cluster: SolanaCluster;
  env: GatewayEnv;
  tokens: WalletTokenBalance[];
}): Promise<WalletTokenBalance[]> {
  if (cluster !== "solana:devnet") {
    return tokens;
  }

  const needsLogo = tokens.some(
    (token) => token.mint === devnetUsdcMint && !token.logo,
  );

  if (!needsLogo) {
    return tokens;
  }

  const mainnetUrl = configuredUrl(env.HELIUS_MAINNET_RPC_URL);
  if (!mainnetUrl) {
    return tokens;
  }

  const mainnetLogo = (
    await fetchTokenDisplayMetadataBatch(mainnetUrl, [mainnetUsdcMint])
  ).get(mainnetUsdcMint)?.logo;

  if (!mainnetLogo) {
    return tokens;
  }

  return tokens.map((token) =>
    token.mint === devnetUsdcMint && !token.logo
      ? { ...token, logo: mainnetLogo }
      : token,
  );
}

async function fetchPortfolioFromRpcUrl({
  address,
  cluster,
  env,
  url,
}: {
  address: string;
  cluster: SolanaCluster;
  env: GatewayEnv;
  url: string;
}): Promise<WalletPortfolio> {
  const rawBalance = await rpcRequest(url, "getBalance", [address]);
  const balance = balanceResultSchema.parse(rawBalance);
  const tokenAccounts = await fetchTokenAccounts(url, address);
  const metadataUrl = metadataRpcUrl(env, cluster);
  const dasTokenAccounts = metadataUrl
    ? await fetchFungibleAssetsByOwner(metadataUrl, address)
    : null;
  const fallbackTokens =
    metadataUrl && (!dasTokenAccounts || dasTokenAccounts.length === 0)
      ? await enrichTokenBalancesWithMetadata(metadataUrl, tokenAccounts)
      : tokenAccounts;
  const mergedTokens = dasTokenAccounts
    ? mergeDasAndRpcTokenBalances({
        dasBalances: dasTokenAccounts,
        rpcBalances: fallbackTokens,
      })
    : fallbackTokens;
  const tokens = await applyDevnetUsdcLogoFromMainnet({
    cluster,
    env,
    tokens: mergedTokens,
  });
  const nativeSolMetadata = metadataUrl
    ? (await fetchTokenDisplayMetadataBatch(metadataUrl, [nativeSolMint])).get(nativeSolMint)
    : null;

  return {
    address,
    cluster,
    fetchedAt: new Date().toISOString(),
    sol: {
      lamports: balance.value.toString(),
      uiAmount: balance.value / lamportsPerSol,
      ...(nativeSolMetadata?.logo ? { logo: nativeSolMetadata.logo } : {}),
    },
    tokens,
  };
}

export async function fetchWalletPortfolioFromRpc({
  address,
  cluster,
  env,
}: {
  address: string;
  cluster: SolanaCluster;
  env: GatewayEnv;
}): Promise<WalletPortfolio> {
  const providerConfig = rpcProviderConfig(env, cluster);

  if (providerConfig.urls.length === 0) {
    throw new RpcBalanceError({
      code: "rpc_config_missing",
      message: `No gateway RPC URL is configured for ${cluster}.`,
      status: 503,
      details: {
        expectedKeys: providerConfig.expectedKeys,
      },
    });
  }

  let lastError: unknown;

  for (const url of providerConfig.urls) {
    try {
      return await fetchPortfolioFromRpcUrl({
        address,
        cluster,
        env,
        url,
      });
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof RpcBalanceError) {
    throw lastError;
  }

  throw new RpcBalanceError({
    code: "balances_unavailable",
    message: "Unable to read wallet balances from configured Solana RPC providers.",
    status: 502,
  });
}
