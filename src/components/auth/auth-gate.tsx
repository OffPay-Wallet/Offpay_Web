"use client";

import { useLogin, useModalStatus, usePrivy } from "@privy-io/react-auth";
import Image from "next/image";
import { useCallback, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { offpayAppIconPath } from "@/lib/offpay/public-config";

type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const { authenticated, ready } = usePrivy();
  const { isOpen } = useModalStatus();
  const { login } = useLogin();

  const openLogin = useCallback(() => {
    if (!ready || authenticated) {
      return;
    }

    login({
      loginMethods: ["email", "google", "twitter", "wallet"],
      walletChainType: "solana-only",
    });
  }, [authenticated, login, ready]);

  if (ready && authenticated) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <main
        aria-busy="true"
        className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src={offpayAppIconPath}
            alt="Offpay app icon"
            width={64}
            height={64}
            priority
            className="h-10 w-10 object-contain sm:h-12 sm:w-12"
          />
          <p className="text-sm text-muted-foreground">Preparing Privy</p>
        </div>
      </main>
    );
  }

  return (
    <main aria-busy={isOpen} className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center px-4 py-7 sm:py-8">
        <Image
          src={offpayAppIconPath}
          alt="Offpay app icon"
          width={64}
          height={64}
          priority
          className="h-10 w-10 object-contain sm:h-12 sm:w-12"
        />
        <section className="flex flex-1 flex-col items-center justify-center pb-14 text-center sm:pb-20">
          <div className="space-y-8 sm:space-y-10">
            <div className="space-y-6">
              <h1 className="text-4xl font-bold leading-tight text-foreground sm:text-5xl">
                Solana wallet sessions.
                <span className="block">Gateway-protected sessions.</span>
                <span className="block text-muted-foreground">Review before signature.</span>
              </h1>
              <p className="text-base leading-7 text-muted-foreground sm:text-lg">
                Sign in with Privy, then connect an existing Solana wallet.
                <span className="block">Every value-moving action stays a draft until you sign.</span>
              </p>
            </div>
            <div className="flex flex-col items-center">
              <Button
                type="button"
                aria-haspopup="dialog"
                onClick={openLogin}
                disabled={isOpen}
                className="h-12 w-full min-w-72 max-w-sm rounded-full bg-foreground px-10 text-base font-semibold text-background shadow-lg shadow-foreground/10 hover:bg-foreground/90 sm:min-w-96"
              >
                Get started
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
