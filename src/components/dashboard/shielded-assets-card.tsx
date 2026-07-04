"use client";

import { UmbraVaultPanel } from "@/components/umbra/umbra-vault-panel";
import type { WebWalletCustody } from "@/lib/offpay/types";

export function ShieldedAssetsCard({
  gatewayOrigin,
  onSignSession,
  sessionId,
  sessionToken,
  signSessionError,
  signingSession,
  walletAddress,
  walletCustody,
}: {
  gatewayOrigin: string | undefined;
  onSignSession?: () => void | Promise<void>;
  sessionId?: string | null | undefined;
  sessionToken?: string | null | undefined;
  signSessionError?: string | null | undefined;
  signingSession?: boolean;
  walletAddress: string | undefined;
  walletCustody: WebWalletCustody | undefined;
}) {
  return (
    <section className="flex h-full flex-col rounded-[28px] border border-border/60 bg-card/80 p-5 text-card-foreground shadow-[0_28px_80px_rgba(0,0,0,0.32)] backdrop-blur-sm md:p-6">
      <UmbraVaultPanel
        compact
        gatewayOrigin={gatewayOrigin}
        onSignSession={onSignSession}
        sessionId={sessionId}
        sessionToken={sessionToken}
        signSessionError={signSessionError}
        signingSession={signingSession}
        walletAddress={walletAddress}
        walletCustody={walletCustody}
      />
    </section>
  );
}
