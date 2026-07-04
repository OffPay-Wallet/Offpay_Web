"use client";

import { UmbraVaultPanel } from "@/components/umbra/umbra-vault-panel";

export function ShieldedAssetsCard({
  gatewayOrigin,
  walletAddress,
}: {
  gatewayOrigin: string | undefined;
  walletAddress: string | undefined;
}) {
  return (
    <section className="flex h-full flex-col rounded-[28px] border border-border/60 bg-card/80 p-5 text-card-foreground shadow-[0_28px_80px_rgba(0,0,0,0.32)] backdrop-blur-sm md:p-6">
      <UmbraVaultPanel
        compact
        gatewayOrigin={gatewayOrigin}
        walletAddress={walletAddress}
      />
    </section>
  );
}
