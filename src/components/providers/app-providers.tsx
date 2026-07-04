"use client";

import {
  PrivyProvider,
  createWalletCreationOnLoginPlugin,
  type PrivyClientConfig,
  usePrivy,
} from "@privy-io/react-auth";
import {
  toSolanaWalletConnectors,
  useCreateWallet,
  useWallets,
} from "@privy-io/react-auth/solana";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Image from "next/image";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "sonner";

import { AuthGate } from "@/components/auth/auth-gate";
import { clearPrivyAuthSessionStateForOAuthCallback } from "@/lib/offpay/browser-session-cleanup";
import { debugLog, debugWarn, redactIdentifier } from "@/lib/offpay/debug";
import {
  getPrivyAppId,
  getPrivyClientId,
  offpayAppIconPath,
  offpayPrivyLogoPath,
} from "@/lib/offpay/public-config";
import { shouldCreateSolanaEmbeddedWalletOnLogin } from "@/lib/offpay/privy-wallet-policy";
import { isPrivyEmbeddedSolanaWallet } from "@/lib/offpay/solana-wallets";

const privyLoginMethods = [
  "email",
  "google",
  "twitter",
  "wallet",
] satisfies NonNullable<PrivyClientConfig["loginMethods"]>;

const solanaWalletList = [
  "detected_solana_wallets",
  "phantom",
  "solflare",
  "backpack",
  "jupiter",
  "wallet_connect_qr_solana",
] satisfies NonNullable<NonNullable<PrivyClientConfig["appearance"]>["walletList"]>;

const solanaWalletConnectors = toSolanaWalletConnectors({
  // Keep extension wallets available in Privy's modal, but require an explicit
  // user action before restoring any browser wallet connection.
  shouldAutoConnect: false,
});

const solanaEmbeddedWalletCreationPlugin = createWalletCreationOnLoginPlugin({
  shouldCreateWallet: shouldCreateSolanaEmbeddedWalletOnLogin,
});

const externalWalletsConfig = {
  walletConnect: {
    enabled: true,
  },
  solana: {
    connectors: solanaWalletConnectors,
  },
} satisfies NonNullable<PrivyClientConfig["externalWallets"]>;

function buildPrivyConfig(): PrivyClientConfig {
  return {
    loginMethods: privyLoginMethods,
    appearance: {
      logo: offpayPrivyLogoPath,
      showWalletLoginFirst: false,
      walletChainType: "solana-only",
      walletList: solanaWalletList,
    },
    externalWallets: externalWalletsConfig,
    plugins: [solanaEmbeddedWalletCreationPlugin],
    embeddedWallets: {
      ethereum: {
        createOnLogin: "off",
      },
      solana: {
        createOnLogin: "all-users",
      },
      showWalletUIs: false,
    },
  };
}

function SolanaWalletBootstrap({ children }: { children: ReactNode }) {
  const { authenticated, ready: privyReady, user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const { ready: walletsReady, wallets } = useWallets();
  const creationAttemptUserRef = useRef<string | null>(null);
  const hasEmbeddedSolanaWallet = wallets.some(isPrivyEmbeddedSolanaWallet);
  const shouldCreateEmbeddedWallet = Boolean(
    authenticated &&
      privyReady &&
      walletsReady &&
      user &&
      wallets.length === 0 &&
      !hasEmbeddedSolanaWallet &&
      shouldCreateSolanaEmbeddedWalletOnLogin({ user }),
  );

  useEffect(() => {
    if (!shouldCreateEmbeddedWallet || !user) {
      return;
    }

    if (creationAttemptUserRef.current === user.id) {
      return;
    }

    creationAttemptUserRef.current = user.id;
    debugLog("wallet.embedded_create.start", {
      privyUserId: redactIdentifier(user.id),
    });

    void createWallet()
      .then(({ wallet }) => {
        debugLog("wallet.embedded_create.success", {
          walletAddress: redactIdentifier(wallet.address),
        });
      })
      .catch((error: unknown) => {
        debugWarn("wallet.embedded_create.failed", {
          error: error instanceof Error ? error.message : String(error),
          privyUserId: redactIdentifier(user.id),
        });
      });
  }, [createWallet, shouldCreateEmbeddedWallet, user]);

  return <>{children}</>;
}

function PrivySetupRequired() {
  return (
    <main className="bg-app-gradient flex min-h-screen items-center justify-center p-4 text-foreground">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-5 text-card-foreground">
        <Image
          src={offpayAppIconPath}
          alt="Offpay app icon"
          width={48}
          height={48}
          priority
          className="h-12 w-12 rounded-lg border border-border bg-background"
        />
        <h1 className="mt-4 text-base font-semibold">Privy setup required</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Set NEXT_PUBLIC_PRIVY_APP_ID to open Offpay Web.
        </p>
      </section>
    </main>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const privyAppId = getPrivyAppId();
  const privyClientId = getPrivyClientId();
  const [oauthCallbackAuthReset] = useState(() => clearPrivyAuthSessionStateForOAuthCallback());
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 20_000,
          },
        },
      }),
  );
  const privyConfig = useMemo(() => buildPrivyConfig(), []);

  useEffect(() => {
    if (!oauthCallbackAuthReset.oauthCallbackDetected) {
      return;
    }

    debugLog("auth.oauth_callback.bootstrap", {
      activeUserIds: oauthCallbackAuthReset.activeUserIds.map(
        (userId) => redactIdentifier(userId) ?? "[empty]",
      ),
      removedCookieCount: oauthCallbackAuthReset.removedCookieCount,
      removedStorageKeyCount: oauthCallbackAuthReset.removedStorageKeyCount,
    });
  }, [oauthCallbackAuthReset]);

  const content = privyAppId ? (
    <PrivyProvider
      appId={privyAppId}
      {...(privyClientId ? { clientId: privyClientId } : {})}
      config={privyConfig}
    >
      <AuthGate>
        <SolanaWalletBootstrap>{children}</SolanaWalletBootstrap>
      </AuthGate>
    </PrivyProvider>
  ) : (
    <PrivySetupRequired />
  );

  return (
    <QueryClientProvider client={queryClient}>
      {content}
      <Toaster richColors closeButton position="top-right" />
    </QueryClientProvider>
  );
}
