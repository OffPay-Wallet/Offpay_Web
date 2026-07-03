import { z } from "zod";

import type {
  SolanaCluster,
  WalletPortfolio,
  WalletTokenBalance,
} from "../../../src/lib/offpay/types";
import type { GatewayEnv } from "./types";

const lamportsPerSol = 1_000_000_000;
const splTokenProgramId = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const token2022ProgramId = "TokenzQdBNbLqP5VEhdkAS6EPF8MZCShU6xm5Y5kKbVQ";

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

function rpcProviderConfig(env: GatewayEnv, cluster: SolanaCluster): RpcProviderConfig {
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

async function rpcRequest(url: string, method: string, params: unknown[]): Promise<unknown> {
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
  url,
}: {
  address: string;
  cluster: SolanaCluster;
  url: string;
}): Promise<WalletPortfolio> {
  const rawBalance = await rpcRequest(url, "getBalance", [address]);
  const balance = balanceResultSchema.parse(rawBalance);
  const tokens = await fetchTokenAccounts(url, address);

  return {
    address,
    cluster,
    fetchedAt: new Date().toISOString(),
    sol: {
      lamports: balance.value.toString(),
      uiAmount: balance.value / lamportsPerSol,
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
