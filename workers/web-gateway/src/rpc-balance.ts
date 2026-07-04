import { z } from "zod";

import type {
  SolanaCluster,
  WalletPortfolio,
  WalletTokenBalance,
} from "../../../src/lib/offpay/types";
import {
  RpcBalanceError,
  metadataRpcUrl,
  rpcProviderConfig,
  rpcRequest,
} from "./rpc-core";
import { applyKnownTokenBalanceMetadata } from "./known-token-metadata";
import {
  applyDevnetUsdcLogoFromMainnet,
  enrichTokenBalancesWithMetadata,
  fetchFungibleAssetsByOwner,
  fetchTokenDisplayMetadataBatch,
  nativeSolMint,
} from "./token-metadata";
import type { GatewayEnv } from "./types";

export { RpcBalanceError, rpcProviderConfig, rpcRequest } from "./rpc-core";

const lamportsPerSol = 1_000_000_000;
const splTokenProgramId = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const token2022ProgramId = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

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
    tokens: applyKnownTokenBalanceMetadata({ cluster, env, tokens: mergedTokens }),
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
