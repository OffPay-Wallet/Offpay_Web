"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Loader2, LockKeyhole, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useSolanaWalletAccount } from "@/hooks/use-solana-wallet-account";
import { readGatewayUmbraVaultHoldings } from "@/lib/offpay/gateway-client";
import { readStoredGatewaySession } from "@/lib/offpay/gateway-session-storage";
import { getGatewayOrigin, getPublicSolanaCluster } from "@/lib/offpay/public-config";
import type { UmbraVaultHolding, WebWalletCustody } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

type UmbraVaultPanelProps = {
  className?: string;
  compact?: boolean;
  gatewayOrigin?: string | undefined;
  onSignSession?: () => void | Promise<void>;
  sessionId?: string | null | undefined;
  sessionToken?: string | null | undefined;
  signSessionError?: string | null | undefined;
  signingSession?: boolean;
  walletAddress?: string | undefined;
  walletCustody?: WebWalletCustody | undefined;
};

function truncateMint(value: string): string {
  return value.length > 12 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value;
}

export function UmbraVaultPanel({
  className,
  compact = false,
  gatewayOrigin: gatewayOriginProp,
  onSignSession,
  sessionId: sessionIdProp,
  sessionToken: sessionTokenProp,
  signSessionError,
  signingSession,
  walletAddress: walletAddressProp,
  walletCustody: walletCustodyProp,
}: UmbraVaultPanelProps) {
  const wallet = useSolanaWalletAccount();
  const cluster = getPublicSolanaCluster();
  const gatewayOrigin = gatewayOriginProp ?? getGatewayOrigin();
  const walletAddress = walletAddressProp ?? wallet.walletAddress;
  const walletCustody = walletCustodyProp ?? wallet.walletCustody;
  const explicitSessionToken = sessionTokenProp ?? undefined;

  const storedSessionQuery = useQuery({
    enabled: Boolean(!explicitSessionToken && gatewayOrigin && walletAddress),
    queryKey: ["gateway-session-storage", gatewayOrigin, cluster, walletAddress],
    queryFn: async () => {
      if (!gatewayOrigin || !walletAddress) return null;
      return readStoredGatewaySession({ cluster, gatewayOrigin, walletAddress });
    },
  });

  const storedSession = storedSessionQuery.data ?? null;
  const storedSessionMatchesWallet = Boolean(
    storedSession &&
      storedSession.session.identity.address === walletAddress &&
      storedSession.session.identity.custody === walletCustody,
  );
  const sessionToken = explicitSessionToken
    ?? (storedSessionMatchesWallet ? storedSession?.sessionToken : undefined);
  const sessionId =
    sessionIdProp ?? (storedSessionMatchesWallet ? storedSession?.session.id : undefined);

  const holdingsQuery = useQuery({
    enabled: Boolean(gatewayOrigin && sessionToken),
    queryKey: ["umbra-vault-holdings", gatewayOrigin, cluster, walletAddress, sessionId],
    queryFn: async () => {
      if (!gatewayOrigin || !sessionToken) {
        throw new Error("Gateway session is not ready.");
      }

      const envelope = await readGatewayUmbraVaultHoldings(gatewayOrigin, sessionToken);

      if (!envelope.ok) {
        throw new Error(envelope.error.message);
      }

      return envelope.data;
    },
  });

  const holdings = holdingsQuery.data?.holdings ?? [];
  const canDeposit = Boolean(walletAddress && sessionToken && holdings.some((row) => row.depositEnabled));

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Umbra vault
          </p>
          <h2
            className={cn(
              "mt-1 font-display font-bold leading-tight tracking-tight",
              compact ? "text-2xl" : "text-3xl",
            )}
          >
            Encrypted holdings
          </h2>
        </div>
        <DepositAction enabled={canDeposit} compact={compact} />
      </div>

      <VaultContent
        compact={compact}
        error={holdingsQuery.error}
        holdings={holdings}
        isError={holdingsQuery.isError}
        isLoading={holdingsQuery.isLoading || storedSessionQuery.isLoading}
        onRetry={() => void holdingsQuery.refetch()}
        onSignSession={onSignSession}
        sessionReady={Boolean(sessionToken)}
        signSessionError={signSessionError}
        signingSession={signingSession}
        walletReady={Boolean(walletAddress)}
      />
    </div>
  );
}

function DepositAction({ compact, enabled }: { compact: boolean; enabled: boolean }) {
  if (!enabled) {
    return (
      <Button type="button" size={compact ? "sm" : "default"} disabled>
        Deposit
      </Button>
    );
  }

  return (
    <Link
      href="/send?flow=umbra-deposit"
      className={cn(buttonVariants({ size: compact ? "sm" : "default" }), "shrink-0")}
    >
      Deposit
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function VaultContent({
  compact,
  error,
  holdings,
  isError,
  isLoading,
  onRetry,
  onSignSession,
  sessionReady,
  signSessionError,
  signingSession,
  walletReady,
}: {
  compact: boolean;
  error: Error | null;
  holdings: UmbraVaultHolding[];
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  onSignSession?: () => void | Promise<void>;
  sessionReady: boolean;
  signSessionError?: string | null | undefined;
  signingSession?: boolean;
  walletReady: boolean;
}) {
  if (!walletReady) {
    return <VaultEmptyState title="Connect wallet" compact={compact} />;
  }

  if (!sessionReady) {
    if (!onSignSession) {
      return <VaultEmptyState title="Sign session" compact={compact} />;
    }

    return (
      <VaultSignInState
        compact={compact}
        error={signSessionError ?? null}
        onSignSession={onSignSession}
        signing={Boolean(signingSession)}
      />
    );
  }

  if (isLoading) {
    return <VaultRowsSkeleton compact={compact} />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          Unable to sync encrypted holdings
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {error?.message ?? "Umbra vault data is unavailable."}
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  if (holdings.length === 0) {
    return <VaultEmptyState title="No supported tokens" compact={compact} />;
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {holdings.map((holding) => (
        <HoldingRow key={holding.mint} compact={compact} holding={holding} />
      ))}
    </div>
  );
}

function VaultSignInState({
  compact,
  error,
  onSignSession,
  signing,
}: {
  compact: boolean;
  error: string | null;
  onSignSession: () => void | Promise<void>;
  signing: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-dashed border-border p-4",
        compact ? "min-h-24" : "min-h-32",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Sign session</p>
          <p className="text-xs text-muted-foreground">
            Sign a message to unlock your encrypted holdings.
          </p>
        </div>
      </div>
      <Button
        type="button"
        size={compact ? "sm" : "default"}
        className="self-start"
        disabled={signing}
        onClick={() => void onSignSession()}
      >
        {signing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Signing…
          </>
        ) : (
          "Sign session"
        )}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function VaultEmptyState({ compact, title }: { compact: boolean; title: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-dashed border-border p-4",
        compact ? "min-h-24" : "min-h-32",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <LockKeyhole className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold">{title}</p>
    </div>
  );
}

function VaultRowsSkeleton({ compact }: { compact: boolean }) {
  const rows = compact ? 2 : 3;

  return (
    <div className="divide-y divide-border rounded-lg border border-border" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-3 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-muted motion-safe:animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-16 rounded bg-muted motion-safe:animate-pulse" />
              <div className="h-3 w-24 rounded bg-muted motion-safe:animate-pulse" />
            </div>
          </div>
          <div className="h-6 w-20 rounded bg-muted motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function HoldingRow({
  compact,
  holding,
}: {
  compact: boolean;
  holding: UmbraVaultHolding;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3",
        compact ? "p-3" : "p-4",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold text-secondary-foreground">
          {holding.symbol.slice(0, 2)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{holding.symbol}</p>
          <p className="truncate text-xs text-muted-foreground">
            {holding.name || truncateMint(holding.mint)}
          </p>
        </div>
      </div>
      <Badge tone="success" className="shrink-0">
        {holding.balanceLabel}
      </Badge>
    </div>
  );
}
