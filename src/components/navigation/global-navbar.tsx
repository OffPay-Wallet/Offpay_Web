import { SolPriceTicker } from "@/components/navigation/sol-price-ticker";
import { WalletAccountControl } from "@/components/wallet/wallet-account-control";

export function GlobalNavbar() {
  return (
    <header className="bg-app-gradient z-30 shrink-0">
      <div className="flex min-h-16 items-center justify-end gap-3 px-4 py-3 sm:gap-5 md:px-6 lg:px-8">
        <SolPriceTicker />
        <WalletAccountControl />
      </div>
    </header>
  );
}
