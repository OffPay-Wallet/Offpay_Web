import { Gamepad2 } from "lucide-react";

import { ProductWorkspacePage } from "@/components/offpay/product-workspace-page";

const stats = [
  { label: "Mode", value: "Arcade", helper: "Gamified payment and reward shell." },
  { label: "Sessions", value: "Draft", helper: "Rounds can map to wallet actions." },
  { label: "Rewards", value: "Queued", helper: "Claim routing is pending." },
] as const;

const lanes = [
  {
    title: "Game rails",
    description: "Challenge, escrow, and reward states are grouped per session.",
    state: "Design",
  },
  {
    title: "Claim review",
    description: "Reward outcomes resolve before the wallet signs a claim.",
    state: "Queued",
  },
  {
    title: "Private rewards",
    description: "Arcade flows can reuse shielded payment boundaries.",
    state: "Ready",
  },
] as const;

export default function ArcadePage() {
  return (
    <ProductWorkspacePage
      eyebrow="Products"
      title="Arcade"
      description="Arcade workspace for challenge sessions, reward drafts, and wallet-confirmed claims."
      icon={<Gamepad2 className="h-5 w-5" aria-hidden="true" />}
      stats={stats}
      lanes={lanes}
    />
  );
}
