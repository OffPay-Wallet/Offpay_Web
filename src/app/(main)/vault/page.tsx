import { LockKeyhole } from "lucide-react";

import { PageHeader } from "@/components/offpay/page-header";
import { SectionCard } from "@/components/offpay/section-card";
import { UmbraVaultPanel } from "@/components/umbra/umbra-vault-panel";

export default function VaultPage() {
  return (
    <>
      <PageHeader
        eyebrow="Vault"
        title="Umbra vault"
        description="Encrypted holdings synced through the Offpay Worker."
      />

      <SectionCard
        title="Encrypted holdings"
        icon={<LockKeyhole className="h-5 w-5" aria-hidden="true" />}
      >
        <UmbraVaultPanel />
      </SectionCard>
    </>
  );
}
