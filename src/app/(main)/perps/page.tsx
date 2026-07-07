import { ChartCandlestick } from "lucide-react";

import { ProductWorkspacePage } from "@/components/offpay/product-workspace-page";

const stats = [
  { label: "Mode", value: "Perps", helper: "Margin and market route shell." },
  { label: "Risk", value: "Isolated", helper: "Position reviews stay wallet-confirmed." },
  { label: "Quotes", value: "Queued", helper: "Worker quote routing is pending." },
] as const;

const lanes = [
  {
    title: "Market watch",
    description: "SOL, BTC, and ETH contracts are staged for route discovery.",
    state: "Design",
  },
  {
    title: "Position review",
    description: "Leverage, liquidation, and fee rows will resolve before signing.",
    state: "Queued",
  },
  {
    title: "Wallet execution",
    description: "Orders remain unsigned until the connected wallet confirms.",
    state: "Ready",
  },
] as const;

export default function PerpsPage() {
  return (
    <ProductWorkspacePage
      eyebrow="Products"
      title="Perps"
      description="Perpetual market workspace for isolated-position review and wallet-confirmed execution."
      icon={<ChartCandlestick className="h-5 w-5" aria-hidden="true" />}
      stats={stats}
      lanes={lanes}
    />
  );
}
