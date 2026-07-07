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
    <section className="offpay-dashboard-card flex h-full flex-col p-5 text-card-foreground md:p-6">
      <UmbraVaultPanel
        compact
        gatewayOrigin={gatewayOrigin}
        walletAddress={walletAddress}
      />
    </section>
  );
}
