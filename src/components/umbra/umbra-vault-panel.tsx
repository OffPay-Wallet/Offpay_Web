"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, LockKeyhole } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { VaultActionForm } from "@/components/umbra/umbra-vault-action-form";
import { VaultContent } from "@/components/umbra/umbra-vault-content";
import { useSolanaWalletAccount } from "@/hooks/use-solana-wallet-account";
import {
  readGatewayPublicBalances,
  readGatewayTokenMetadata,
  readGatewayUmbraVaultHoldings,
} from "@/lib/offpay/gateway-client";
import { getGatewayOrigin, getPublicSolanaCluster } from "@/lib/offpay/public-config";
import type { UmbraVaultHolding, WalletTokenMetadata } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

type UmbraVaultPanelProps = {
  className?: string;
  compact?: boolean;
  gatewayOrigin?: string | undefined;
  walletAddress?: string | undefined;
};

const emptyHoldings: UmbraVaultHolding[] = [];
const emptyLogoMap: Record<string, WalletTokenMetadata> = {};

export function UmbraVaultPanel({
  className,
  compact = false,
  gatewayOrigin: gatewayOriginProp,
  walletAddress: walletAddressProp,
}: UmbraVaultPanelProps) {
  const wallet = useSolanaWalletAccount();
  const cluster = getPublicSolanaCluster();
  const gatewayOrigin = gatewayOriginProp ?? getGatewayOrigin();
  const walletAddress = walletAddressProp ?? wallet.walletAddress;

  const holdingsQuery = useQuery({
    enabled: Boolean(gatewayOrigin && walletAddress),
    queryKey: ["umbra-vault-holdings", gatewayOrigin, cluster, walletAddress],
    queryFn: async () => {
      if (!gatewayOrigin || !walletAddress) {
        throw new Error("Wallet address is not available.");
      }

      const envelope = await readGatewayUmbraVaultHoldings(gatewayOrigin, {
        network: cluster,
        walletAddress,
      });

      if (!envelope.ok) {
        throw new Error(envelope.error.message);
      }

      return envelope.data;
    },
  });

  const holdings = holdingsQuery.data?.holdings ?? emptyHoldings;
  const walletReady = Boolean(walletAddress);

  const holdingMints = useMemo(
    () => Array.from(new Set(holdings.map((holding) => holding.mint))),
    [holdings],
  );

  const metadataQuery = useQuery({
    enabled: Boolean(gatewayOrigin) && holdingMints.length > 0,
    queryKey: ["umbra-vault-token-metadata", gatewayOrigin, cluster, holdingMints],
    queryFn: async () => {
      if (!gatewayOrigin) {
        throw new Error("Gateway origin is not available.");
      }

      const envelope = await readGatewayTokenMetadata(gatewayOrigin, {
        network: cluster,
        mints: holdingMints,
      });

      if (!envelope.ok) {
        throw new Error(envelope.error.message);
      }

      return envelope.data;
    },
  });

  const logoByMint = metadataQuery.data?.metadata ?? emptyLogoMap;

  const publicBalancesQuery = useQuery({
    enabled: Boolean(gatewayOrigin && walletAddress) && !compact,
    queryKey: ["umbra-vault-public-balances", gatewayOrigin, cluster, walletAddress],
    queryFn: async () => {
      if (!gatewayOrigin || !walletAddress) {
        throw new Error("Wallet address is not available.");
      }

      const envelope = await readGatewayPublicBalances(gatewayOrigin, {
        network: cluster,
        walletAddress,
      });

      if (!envelope.ok) {
        throw new Error(envelope.error.message);
      }

      return envelope.data;
    },
  });

  const holdingsContent = (
    <VaultContent
      compact={compact}
      error={holdingsQuery.error}
      holdings={holdings}
      isError={holdingsQuery.isError}
      isLoading={holdingsQuery.isLoading}
      logoByMint={logoByMint}
      onRetry={() => void holdingsQuery.refetch()}
      walletReady={walletReady}
    />
  );

  if (compact) {
    return (
      <div className={cn("flex h-full min-h-0 flex-col", className)}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vault
            </p>
            <h2 className="mt-0.5 font-display text-xl font-bold leading-tight tracking-tight">
              Encrypted holdings
            </h2>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{holdingsContent}</div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/vault"
            className={cn(buttonVariants({ variant: "primary" }), "rounded-full")}
          >
            <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
            Shield
          </Link>
          <Link
            href="/vault"
            className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
          >
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            Unshield
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-5 xl:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1fr)]",
        className,
      )}
    >
      <div>
        <VaultActionForm
          activeWallet={wallet.activeWallet}
          cluster={cluster}
          compact={compact}
          gatewayOrigin={gatewayOrigin}
          holdings={holdings}
          isLoading={holdingsQuery.isLoading}
          onActionComplete={() => {
            void holdingsQuery.refetch();
            void publicBalancesQuery.refetch();
          }}
          onPortfolioRetry={() => void publicBalancesQuery.refetch()}
          portfolio={publicBalancesQuery.data}
          portfolioError={publicBalancesQuery.error}
          portfolioLoading={publicBalancesQuery.isLoading || publicBalancesQuery.isFetching}
          walletReady={walletReady}
        />
      </div>

      <section className="min-w-0 rounded-lg border border-border bg-card p-5 text-card-foreground">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Encrypted holdings</h2>
          <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
        {holdingsContent}
      </section>
    </div>
  );
}
