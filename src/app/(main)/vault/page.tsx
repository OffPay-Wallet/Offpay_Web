import { PageHeader } from "@/components/offpay/page-header";
import { MatrixRain } from "@/components/ui/matrix-rain";
import { UmbraVaultPanel } from "@/components/umbra/umbra-vault-panel";

export default function VaultPage() {
  return (
    <div className="relative isolate min-h-full">
      {/* Ambient matrix-rain backdrop. Sits behind the (opaque) vault cards and
          fades toward the bottom so content stays crisp. */}
      <MatrixRain
        className="absolute inset-0 -z-10 opacity-50 [mask-image:linear-gradient(to_bottom,#000_0%,#000_55%,transparent_100%)]"
        fontSize={15}
        fps={24}
      />

      <PageHeader eyebrow="Vault" title="Umbra vault" />

      <UmbraVaultPanel />
    </div>
  );
}
