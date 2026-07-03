"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { PublicAssetsCard } from "@/components/dashboard/public-assets-card";
import { ShieldedAssetsCard } from "@/components/dashboard/shielded-assets-card";
import { WalletBalanceSummary } from "@/components/dashboard/wallet-balance-summary";
import { WalletDashboardHeader } from "@/components/dashboard/wallet-dashboard-header";
import { useSolanaWalletAccount } from "@/hooks/use-solana-wallet-account";
import { getErrorMessage } from "@/lib/offpay/display";
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
import { getGatewayOrigin, getPublicSolanaCluster } from "@/lib/offpay/public-config";
import type { WebSession } from "@/lib/offpay/types";

type SessionReadState = "idle" | "loading" | "ready" | "missing" | "error";

export function WalletDashboard() {
  const {
    activeWalletAddress,
    authenticated,
    connectedWalletAddresses,
    embeddedWalletCount,
    externalWalletCount,
    preferredWalletCustody,
    privyReady,
    signerReady,
    walletAddress,
    walletCount,
    walletCustody,
    walletsReady,
  } = useSolanaWalletAccount();
  const [session, setSession] = useState<WebSession | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionReadState, setSessionReadState] = useState<SessionReadState>("idle");
  const [, setSessionSyncError] = useState<string | null>(null);

  const cluster = getPublicSolanaCluster();
  const gatewayOrigin = getGatewayOrigin();
  const sessionReady = Boolean(
    session &&
      session.identity.address === walletAddress &&
      session.identity.custody === walletCustody,
  );

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
      ready: privyReady,
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
    privyReady,
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

  return (
    <section className="space-y-5">
      <WalletDashboardHeader />

      <WalletBalanceSummary
        isFetching={balancesQuery.isFetching}
        onRefresh={() => void balancesQuery.refetch()}
        publicAssetCount={publicAssetCount}
        solUiAmount={solUiAmount}
        tokenCount={tokens.length}
        walletAddress={walletAddress}
      />

      <ShieldedAssetsCard />

      <PublicAssetsCard
        cluster={cluster}
        error={balancesQuery.error}
        gatewayConfigured={Boolean(gatewayOrigin)}
        isError={balancesQuery.isError}
        isFetching={balancesQuery.isFetching}
        isLoading={balancesQuery.isLoading}
        onRetry={() => void balancesQuery.refetch()}
        portfolio={portfolio}
        walletAddress={walletAddress}
      />
    </section>
  );
}
