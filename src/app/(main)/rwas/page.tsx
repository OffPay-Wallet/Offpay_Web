import { Landmark } from "lucide-react";

import { ProductWorkspacePage } from "@/components/offpay/product-workspace-page";

const stats = [
  { label: "Mode", value: "RWAs", helper: "Tokenized yield and collateral shell." },
  { label: "Access", value: "Gated", helper: "Issuer and jurisdiction checks stay explicit." },
  { label: "Reports", value: "Queued", helper: "Attestation data routes are pending." },
] as const;

const lanes = [
  {
    title: "Asset registry",
    description: "Issuer, maturity, and collateral metadata are staged together.",
    state: "Design",
  },
  {
    title: "Allocation review",
    description: "Position size and redemption terms resolve before a transaction draft.",
    state: "Queued",
  },
  {
    title: "Custody boundary",
    description: "Wallet signatures remain the execution boundary for any allocation.",
    state: "Ready",
  },
] as const;

export default function RwasPage() {
  return (
    <ProductWorkspacePage
      eyebrow="Products"
      title="RWAs"
      description="Real-world asset workspace for tokenized exposure, allocation review, and custody checks."
      icon={<Landmark className="h-5 w-5" aria-hidden="true" />}
      stats={stats}
      lanes={lanes}
    />
  );
}
