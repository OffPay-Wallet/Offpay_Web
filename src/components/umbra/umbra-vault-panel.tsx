"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { VaultActionForm } from "@/components/umbra/umbra-vault-action-form";
import { VaultContent } from "@/components/umbra/umbra-vault-content";
import { useSolanaWalletAccount } from "@/hooks/use-solana-wallet-account";
import { readUmbraEncryptedBalances } from "@/lib/offpay/umbra-vault-execution";
import {
  readGatewayPublicBalances,
  readGatewayMinimumBalanceForRentExemption,
  readGatewayTokenMetadata,
  readGatewayUmbraVaultHoldings,
  readGatewayUmbraVaultRegistrationStatus,
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
  const [balancesRevealed, setBalancesRevealed] = useState(false);

  const registrationQuery = useQuery({
    enabled: Boolean(gatewayOrigin && walletAddress),
    queryKey: ["umbra-vault-registration", gatewayOrigin, cluster, walletAddress],
    queryFn: async () => {
      if (!gatewayOrigin || !walletAddress) {
        throw new Error("Wallet address is not available.");
      }

      const envelope = await readGatewayUmbraVaultRegistrationStatus(gatewayOrigin, {
        network: cluster,
        walletAddress,
      });

      if (!envelope.ok) {
        throw new Error(envelope.error.message);
      }

      return envelope.data;
    },
    staleTime: 30_000,
  });

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

  const decryptedBalancesQuery = useQuery({
    enabled: false,
    queryKey: [
      "umbra-vault-decrypted-balances",
      gatewayOrigin,
      cluster,
      walletAddress,
      holdingMints,
    ],
    queryFn: async () => {
      return readUmbraEncryptedBalances({
        cluster,
        gatewayOrigin,
        mints: holdingMints,
        wallet: wallet.activeWallet,
      });
    },
  });

  const decryptedBalances = balancesRevealed ? decryptedBalancesQuery.data : undefined;
  const decryptedLoading = balancesRevealed && decryptedBalancesQuery.isFetching;
  const decryptedError = balancesRevealed ? decryptedBalancesQuery.error : null;

  const revealControl = (
    <RevealBalancesButton
      disabled={!walletReady || holdings.length === 0}
      loading={decryptedBalancesQuery.isFetching}
      revealed={balancesRevealed}
      onToggle={() => {
        if (balancesRevealed) {
          setBalancesRevealed(false);
          return;
        }
        setBalancesRevealed(true);
        void decryptedBalancesQuery.refetch();
      }}
    />
  );

  const feeReserveQuery = useQuery({
    enabled: Boolean(gatewayOrigin) && !compact,
    queryKey: ["umbra-vault-fee-reserve", gatewayOrigin, cluster],
    queryFn: async () => {
      if (!gatewayOrigin) {
        throw new Error("Gateway origin is not available.");
      }

      return readGatewayMinimumBalanceForRentExemption(gatewayOrigin, {
        network: cluster,
        space: 165,
      });
    },
    staleTime: 60_000,
  });

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
      decryptedBalances={decryptedBalances}
      decryptedError={decryptedError}
      decryptedLoading={decryptedLoading}
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
          <div className="flex shrink-0 items-center gap-2">
            {revealControl}
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
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
            void registrationQuery.refetch();
            void holdingsQuery.refetch();
            void publicBalancesQuery.refetch();
            if (balancesRevealed) {
              void decryptedBalancesQuery.refetch();
            } else {
              setBalancesRevealed(true);
              void decryptedBalancesQuery.refetch();
            }
          }}
          onPortfolioRetry={() => void publicBalancesQuery.refetch()}
          onRegistrationRetry={() => void registrationQuery.refetch()}
          portfolio={publicBalancesQuery.data}
          portfolioError={publicBalancesQuery.error}
          portfolioLoading={publicBalancesQuery.isLoading || publicBalancesQuery.isFetching}
          registrationError={registrationQuery.error}
          registrationLoading={registrationQuery.isLoading || registrationQuery.isFetching}
          registrationStatus={registrationQuery.data}
          feeReserveLamports={feeReserveQuery.data ?? null}
          walletReady={walletReady}
        />
      </div>

      <section className="min-w-0 rounded-lg border border-border bg-card p-5 text-card-foreground">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Encrypted holdings</h2>
          <div className="flex items-center gap-2">
            {revealControl}
            <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
        {holdingsContent}
      </section>
    </div>
  );
}

function RevealBalancesButton({
  disabled,
  loading,
  onToggle,
  revealed,
}: {
  disabled: boolean;
  loading: boolean;
  onToggle: () => void;
  revealed: boolean;
}) {
  const label = loading ? "Decrypting..." : revealed ? "Hide" : "Reveal";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 rounded-full px-3 text-xs"
      disabled={disabled || loading}
      aria-pressed={revealed}
      onClick={onToggle}
    >
      {revealed ? (
        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {label}
    </Button>
  );
}
