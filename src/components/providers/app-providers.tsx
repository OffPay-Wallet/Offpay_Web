"use client";

import {
  PrivyProvider,
  createWalletCreationOnLoginPlugin,
  type PrivyClientConfig,
} from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Image from "next/image";
import { type ReactNode, useMemo, useState } from "react";
import { Toaster } from "sonner";

import { AuthGate } from "@/components/auth/auth-gate";
import {
  getPrivyAppId,
  getPrivyClientId,
  offpayAppIconPath,
  offpayPrivyLogoPath,
} from "@/lib/offpay/public-config";

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
  // Keep external wallet sessions available after login. Embedded wallet
  // creation is explicitly disabled below.
  shouldAutoConnect: true,
});

const disableEmbeddedWalletCreationPlugin = createWalletCreationOnLoginPlugin({
  shouldCreateWallet: () => false,
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
    plugins: [disableEmbeddedWalletCreationPlugin],
    embeddedWallets: {
      ethereum: {
        createOnLogin: "off",
      },
      solana: {
        createOnLogin: "off",
      },
      showWalletUIs: false,
    },
  };
}

function PrivySetupRequired() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
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
  const privyAppId = getPrivyAppId();
  const privyClientId = getPrivyClientId();
  const privyConfig = useMemo(() => buildPrivyConfig(), []);

  const content = privyAppId ? (
    <PrivyProvider
      appId={privyAppId}
      {...(privyClientId ? { clientId: privyClientId } : {})}
      config={privyConfig}
    >
      <AuthGate>{children}</AuthGate>
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
