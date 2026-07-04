import { PageHeader } from "@/components/offpay/page-header";
import { UmbraVaultPanel } from "@/components/umbra/umbra-vault-panel";

export default function VaultPage() {
  return (
    <>
      <PageHeader eyebrow="Vault" title="Umbra vault" />

      <UmbraVaultPanel />
    </>
  );
}
