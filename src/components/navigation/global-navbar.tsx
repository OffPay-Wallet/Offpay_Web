import { WalletAccountControl } from "@/components/wallet/wallet-account-control";

export function GlobalNavbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex min-h-16 items-center justify-end px-4 py-3 md:px-6 lg:px-8">
        <WalletAccountControl />
      </div>
    </header>
  );
}
