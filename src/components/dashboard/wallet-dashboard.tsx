"use client";

import { useLogout, usePrivy } from "@privy-io/react-auth";
import {
  type ConnectedStandardSolanaWallet,
  useWallets,
} from "@privy-io/react-auth/solana";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  ArrowUpRight,
  Coins,
  Copy,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Unplug,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { clearBrowserWalletSessionState } from "@/lib/offpay/browser-session-cleanup";
import { debugLog, debugWarn, redactIdentifier } from "@/lib/offpay/debug";
import {
  readGatewayBalances,
  readGatewayPublicBalances,
  readGatewaySessionStatus,
} from "@/lib/offpay/gateway-client";
import {
  clearStoredGatewaySession,
  readStoredGatewaySession,
} from "@/lib/offpay/gateway-session-storage";
import {
  getGatewayOrigin,
  getPrivyAppId,
  getPublicSolanaCluster,
} from "@/lib/offpay/public-config";
import { preferredWalletCustodyForUser } from "@/lib/offpay/privy-wallet-policy";
import { formatTokenAmount, nativeSolMeta, resolveTokenMeta } from "@/lib/offpay/tokens";
import type { WalletTokenBalance, WebSession, WebWalletCustody } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

type SessionReadState = "idle" | "loading" | "ready" | "missing" | "error";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unexpected wallet error.";
}

function truncateAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatCluster(cluster: string): string {
  const name = cluster.replace("solana:", "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function isPrivyEmbeddedSolanaWallet(wallet: ConnectedStandardSolanaWallet): boolean {
  return Boolean((wallet.standardWallet as { isPrivyWallet?: boolean }).isPrivyWallet);
}

function walletCustodyForWallet(wallet?: ConnectedStandardSolanaWallet): WebWalletCustody | undefined {
  if (!wallet) {
    return undefined;
  }

  return isPrivyEmbeddedSolanaWallet(wallet) ? "privy-solana" : "external-solana";
}

function formatWalletCustody(custody?: WebWalletCustody): string | null {
  if (custody === "privy-solana") {
    return "Privy Solana";
  }

  if (custody === "external-solana") {
    return "External Solana";
  }

  return null;
}

function AssetAvatar({ symbol, native = false }: { symbol: string; native?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase",
        native ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground",
      )}
      aria-hidden="true"
    >
      {native ? <Coins className="h-5 w-5" /> : symbol.slice(0, 3)}
    </span>
  );
}

function AssetRow({
  name,
  symbol,
  amount,
  subLabel,
  native = false,
}: {
  name: string;
  symbol: string;
  amount: string;
  subLabel?: string;
  native?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 p-4 sm:grid-cols-[1.5fr_1fr_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <AssetAvatar symbol={symbol} native={native} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{subLabel ?? symbol}</p>
        </div>
      </div>
      <div className="text-right sm:text-left">
        <p className="text-sm font-semibold tabular-nums">
          {amount} <span className="text-muted-foreground">{symbol}</span>
        </p>
      </div>
      <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
        <Link href="/send" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          Send
        </Link>
        <Button variant="ghost" size="sm" disabled title="Shielding is not enabled yet">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Shield
        </Button>
      </div>
    </div>
  );
}

export function WalletDashboard() {
  const {
    authenticated,
    ready,
    user,
  } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const [session, setSession] = useState<WebSession | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionReadState, setSessionReadState] = useState<SessionReadState>("idle");
  const [, setSessionSyncError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const cluster = getPublicSolanaCluster();
  const gatewayOrigin = getGatewayOrigin();
  const privyAppId = getPrivyAppId();
  const externalWallets = useMemo(
    () => wallets.filter((wallet) => !isPrivyEmbeddedSolanaWallet(wallet)),
    [wallets],
  );
  const embeddedWallets = useMemo(
    () => wallets.filter((wallet) => isPrivyEmbeddedSolanaWallet(wallet)),
    [wallets],
  );
  const preferredWalletCustody = useMemo(() => preferredWalletCustodyForUser(user), [user]);
  const activeWallet = useMemo<ConnectedStandardSolanaWallet | undefined>(() => {
    if (preferredWalletCustody === "external-solana") {
      return externalWallets[0];
    }

    if (preferredWalletCustody === "privy-solana") {
      return embeddedWallets[0];
    }

    return undefined;
  }, [embeddedWallets, externalWallets, preferredWalletCustody]);
  const activeWalletAddress = activeWallet?.address;
  const walletAddress = activeWalletAddress;
  const walletCustody = walletCustodyForWallet(activeWallet);
  const walletCustodyLabel = formatWalletCustody(walletCustody);
  const signerReady = Boolean(activeWallet);
  const sessionReady = Boolean(
    session &&
      session.identity.address === walletAddress &&
      session.identity.custody === walletCustody,
  );
  const walletCount = wallets.length;
  const externalWalletCount = externalWallets.length;
  const embeddedWalletCount = embeddedWallets.length;
  const connectedWalletAddresses = wallets.map((wallet) => wallet.address).join(",");

  const { logout } = useLogout({
    onSuccess: () => {
      void clearBrowserWalletSessionState({ privyAppId });

      if (gatewayOrigin) {
        wallets.forEach((wallet) => {
          clearStoredGatewaySession({
            gatewayOrigin,
            cluster,
            walletAddress: wallet.address,
          });
        });
      }

      setSession(null);
      setSessionToken(null);
      setSessionSyncError(null);
      setSessionReadState("idle");
      toast.success("Disconnected");
    },
  });

  const disconnectAccount = async () => {
    if (!ready || disconnecting) {
      return;
    }

    setDisconnecting(true);

    try {
      await clearBrowserWalletSessionState({ privyAppId });

      const disconnectResults = await Promise.allSettled(
        wallets.map((wallet) => wallet.disconnect()),
      );
      const failedDisconnects = disconnectResults.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failedDisconnects > 0) {
        debugWarn("wallet.disconnect.partial_failure", {
          failedDisconnects,
          walletCount: wallets.length,
        });
      }

      await clearBrowserWalletSessionState({ privyAppId });
      await logout();
      await clearBrowserWalletSessionState({ privyAppId });
    } catch (error: unknown) {
      debugWarn("account.disconnect.failed", {
        error: getErrorMessage(error),
      });
      toast.error(getErrorMessage(error));
    } finally {
      setDisconnecting(false);
    }
  };

  const balancesQuery = useQuery({
    queryKey: [
      "wallet-balances",
      gatewayOrigin,
      walletAddress,
      cluster,
      sessionReady ? session?.id : "public",
    ],
    enabled: Boolean(gatewayOrigin && walletAddress),
    queryFn: async () => {
      const targetWalletAddress = walletAddress;

      if (!gatewayOrigin) {
        throw new Error("Gateway origin is not configured.");
      }

      if (!targetWalletAddress) {
        throw new Error("Wallet address is not available.");
      }

      debugLog("balances.query.start", {
        cluster,
        signedSession: sessionReady,
        walletAddress: redactIdentifier(targetWalletAddress),
      });

      const envelope = sessionReady
        ? await readGatewayBalances(gatewayOrigin, sessionToken ?? undefined)
        : await readGatewayPublicBalances(gatewayOrigin, {
            walletAddress: targetWalletAddress,
            network: cluster,
          });

      if (!envelope.ok) {
        debugWarn("balances.query.failed", {
          cluster,
          requestId: envelope.requestId,
          signedSession: sessionReady,
          walletAddress: redactIdentifier(targetWalletAddress),
          error: envelope.error,
        });
        throw new Error(envelope.error.message);
      }

      debugLog("balances.query.success", {
        cluster: envelope.data.cluster,
        fetchedAt: envelope.data.fetchedAt,
        requestId: envelope.requestId,
        signedSession: sessionReady,
        tokenCount: envelope.data.tokens.length,
        walletAddress: redactIdentifier(envelope.data.address),
      });

      return envelope.data;
    },
  });

  const portfolio = balancesQuery.data;
  const solUiAmount = portfolio?.sol.uiAmount ?? 0;
  const tokens = portfolio?.tokens ?? [];
  const publicAssetCount = portfolio ? tokens.length + 1 : 0;
  const sessionScopeKey =
    gatewayOrigin && walletAddress && walletCustody
      ? `${gatewayOrigin}:${cluster}:${walletAddress}:${walletCustody}`
      : null;

  useEffect(() => {
    if (!authenticated) {
      void Promise.resolve().then(() => {
        setSession(null);
        setSessionToken(null);
        setSessionSyncError(null);
        setSessionReadState("idle");
      });
    }
  }, [authenticated]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setSessionToken(null);
      setSessionSyncError(null);
    });
  }, [sessionScopeKey]);

  useEffect(() => {
    if (!gatewayOrigin || !walletAddress || !walletCustody) {
      return;
    }

    const storedSession = readStoredGatewaySession({
      gatewayOrigin,
      cluster,
      walletAddress,
    });

    if (!storedSession || storedSession.session.identity.custody !== walletCustody) {
      return;
    }

    debugLog("session.storage.restore", {
      cluster: storedSession.session.identity.cluster,
      custody: storedSession.session.identity.custody,
      expiresAt: storedSession.session.expiresAt,
      walletAddress: redactIdentifier(storedSession.session.identity.address),
    });

    void Promise.resolve().then(() => {
      setSession(storedSession.session);
      setSessionToken(storedSession.sessionToken);
      setSessionReadState("ready");
      setSessionSyncError(null);
    });
  }, [cluster, gatewayOrigin, walletAddress, walletCustody]);

  useEffect(() => {
    debugLog("dashboard.wallet_state", {
      activeWallet: signerReady,
      activeWalletAddress: redactIdentifier(activeWalletAddress),
      authenticated,
      balancesFetchEnabled: Boolean(gatewayOrigin && walletAddress),
      cluster,
      custody: walletCustody,
      embeddedWalletCount,
      externalWalletCount,
      gatewayConfigured: Boolean(gatewayOrigin),
      preferredWalletCustody,
      ready,
      sessionReadState,
      sessionReady,
      signerReady,
      connectedWalletAddresses: connectedWalletAddresses
        .split(",")
        .filter(Boolean)
        .map(redactIdentifier),
      walletAddress: redactIdentifier(walletAddress),
      walletCount,
      walletsReady,
    });
  }, [
    activeWalletAddress,
    authenticated,
    cluster,
    connectedWalletAddresses,
    embeddedWalletCount,
    externalWalletCount,
    gatewayOrigin,
    preferredWalletCustody,
    ready,
    sessionReadState,
    sessionReady,
    signerReady,
    walletAddress,
    walletCustody,
    walletCount,
    walletsReady,
  ]);

  useEffect(() => {
    if (!gatewayOrigin || !walletAddress || !walletCustody) {
      debugLog("session.status.skipped", {
        gatewayConfigured: Boolean(gatewayOrigin),
        walletCustody,
        walletAddress: redactIdentifier(walletAddress),
      });
      return;
    }

    let mounted = true;
    const statusSessionToken = sessionToken;

    debugLog("session.status.start", {
      custody: walletCustody,
      walletAddress: redactIdentifier(walletAddress),
    });

    void Promise.resolve().then(() => {
      if (mounted) {
        setSessionReadState("loading");
      }
    });

    void readGatewaySessionStatus(gatewayOrigin, sessionToken ?? undefined)
      .then((envelope) => {
        if (!mounted) {
          return;
        }

        if (
          envelope.ok &&
          envelope.data?.identity.address === walletAddress &&
          envelope.data.identity.custody === walletCustody
        ) {
          debugLog("session.status.ready", {
            cluster: envelope.data.identity.cluster,
            custody: envelope.data.identity.custody,
            requestId: envelope.requestId,
            walletAddress: redactIdentifier(envelope.data.identity.address),
          });
          setSession(envelope.data);
          setSessionReadState("ready");
          setSessionSyncError(null);
          return;
        }

        const logSessionStatus = envelope.ok ? debugLog : debugWarn;

        logSessionStatus("session.status.missing_or_mismatch", {
          ok: envelope.ok,
          requestId: envelope.requestId,
          sessionCustody: envelope.ok ? envelope.data?.identity.custody : undefined,
          sessionWalletAddress: envelope.ok
            ? redactIdentifier(envelope.data?.identity.address)
            : undefined,
          walletCustody,
          walletAddress: redactIdentifier(walletAddress),
          ...(!envelope.ok ? { error: envelope.error } : {}),
        });
        if (statusSessionToken) {
          clearStoredGatewaySession({
            gatewayOrigin,
            cluster,
            walletAddress,
          });
        }
        setSession((current) =>
          current?.identity.address === walletAddress && current.identity.custody === walletCustody
            ? current
            : null,
        );
        setSessionToken((current) => (current === statusSessionToken ? null : current));
        setSessionReadState((current) =>
          current === "ready" ? current : "missing",
        );
      })
      .catch((error: unknown) => {
        if (!mounted) {
          return;
        }

        debugWarn("session.status.error", {
          walletAddress: redactIdentifier(walletAddress),
          error: getErrorMessage(error),
        });
        if (statusSessionToken) {
          clearStoredGatewaySession({
            gatewayOrigin,
            cluster,
            walletAddress,
          });
        }
        setSession((current) =>
          current?.identity.address === walletAddress && current.identity.custody === walletCustody
            ? current
            : null,
        );
        setSessionToken((current) => (current === statusSessionToken ? null : current));
        setSessionReadState((current) =>
          current === "ready" ? current : "missing",
        );
      });

    return () => {
      mounted = false;
    };
  }, [cluster, gatewayOrigin, sessionToken, walletAddress, walletCustody]);

  const copyAddress = async () => {
    if (!walletAddress) {
      return;
    }

    await navigator.clipboard.writeText(walletAddress);
    toast.success("Wallet address copied");
  };

  const publicAssetsContent = () => {
    if (!walletAddress) {
      return (
        <p className="p-4 text-sm text-muted-foreground">
          Preparing your Solana wallet for public balances.
        </p>
      );
    }

    if (!gatewayOrigin) {
      return (
        <p className="p-4 text-sm text-muted-foreground">
          Balance sync is unavailable because the gateway origin is not configured.
        </p>
      );
    }

    if (balancesQuery.isLoading) {
      return (
        <div className="divide-y divide-border">
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center gap-3 p-4">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-secondary" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
                <div className="h-3 w-16 animate-pulse rounded bg-secondary" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (balancesQuery.isError) {
      return (
        <div className="flex flex-col items-start gap-3 p-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TriangleAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
            {getErrorMessage(balancesQuery.error)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={balancesQuery.isFetching}
            onClick={() => void balancesQuery.refetch()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      );
    }

    if (!portfolio) {
      return (
        <p className="p-4 text-sm text-muted-foreground">
          Loading public balances for your connected wallet.
        </p>
      );
    }

    return (
      <div className="divide-y divide-border">
        <AssetRow
          native
          name={nativeSolMeta.name}
          symbol={nativeSolMeta.symbol}
          amount={formatTokenAmount(solUiAmount)}
          subLabel="Native balance"
        />
        {tokens.map((token: WalletTokenBalance) => {
          const meta = resolveTokenMeta(cluster, token.mint);
          const symbol = token.symbol ?? meta.symbol;

          return (
            <AssetRow
              key={`${token.programId ?? "api-worker"}:${token.mint}`}
              name={token.name ?? meta.name}
              symbol={symbol}
              amount={formatTokenAmount(token.uiAmount)}
              subLabel={symbol}
            />
          );
        })}
        {tokens.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            No SPL tokens found for this wallet.
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Dashboard</p>
          <h1 className="text-3xl font-bold leading-tight md:text-4xl">Your wallet</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{formatCluster(cluster)}</Badge>
          {walletCustodyLabel ? <Badge tone="neutral">{walletCustodyLabel}</Badge> : null}
          {walletAddress ? (
            <button
              type="button"
              onClick={copyAddress}
              className="flex max-w-full items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-background"
              title="Copy address"
            >
              <span className="min-w-0 truncate font-mono text-sm font-semibold">
                {truncateAddress(walletAddress)}
              </span>
              <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!ready}
            loading={disconnecting}
            onClick={() => void disconnectAccount()}
          >
            <Unplug className="h-4 w-4" aria-hidden="true" />
            Disconnect
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 text-card-foreground md:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total balance
          </p>
          <button
            type="button"
            onClick={() => void balancesQuery.refetch()}
            disabled={!walletAddress || balancesQuery.isFetching}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40"
            title="Refresh balances"
            aria-label="Refresh balances"
          >
            <RefreshCw
              className={cn("h-4 w-4", balancesQuery.isFetching && "motion-safe:animate-spin")}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums md:text-5xl">
            {portfolio ? formatTokenAmount(solUiAmount) : "--"}
          </span>
          <span className="text-lg font-semibold text-muted-foreground">SOL</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {portfolio
            ? `Native SOL · ${publicAssetCount} public asset${publicAssetCount === 1 ? "" : "s"}`
            : "Connecting wallet and loading balances"}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/send" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            Send
          </Link>
          <Link href="/swap" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
            <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
            Swap
          </Link>
          <Button variant="ghost" size="sm" disabled title="Shielding is not enabled yet">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Shield
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Un-shielded (public)
              </span>
              <Badge tone="success">Live</Badge>
            </div>
            <p className="mt-2 text-xl font-semibold tabular-nums">
              {portfolio ? `${formatTokenAmount(solUiAmount)} SOL` : "--"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {portfolio
                ? `${tokens.length} token${tokens.length === 1 ? "" : "s"} held`
                : "Public on-chain balances"}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Shielded (private)
              </span>
              <Badge tone="neutral">Coming soon</Badge>
            </div>
            <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-muted-foreground">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              Private balance
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Umbra shielded pools are not enabled yet
            </p>
          </div>
        </div>

        {!walletAddress ? (
          <div className="mt-5 flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Preparing your Privy Solana wallet for this account.
            </p>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-card text-card-foreground">
        <div className="flex items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Shielded assets
          </h2>
          <Badge tone="neutral">Coming soon</Badge>
        </div>
        <p className="p-5 text-sm leading-6 text-muted-foreground">
          Private balances will appear here once Umbra shielded pools are enabled for Offpay Web.
          Shielded reads and claims stay protected in the connected wallet session.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card text-card-foreground">
        <div className="flex items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Coins className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Public assets
          </h2>
          <span className="text-xs font-medium uppercase text-muted-foreground">
            {formatCluster(cluster)}
          </span>
        </div>
        {publicAssetsContent()}
      </div>
    </section>
  );
}
