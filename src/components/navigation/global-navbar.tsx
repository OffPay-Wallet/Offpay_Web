import Image from "next/image";
import Link from "next/link";

import { SolPriceTicker } from "@/components/navigation/sol-price-ticker";
import { WalletAccountControl } from "@/components/wallet/wallet-account-control";
import { offpayAppIconPath } from "@/lib/offpay/public-config";

export function GlobalNavbar() {
  return (
    <header className="relative z-30 shrink-0 bg-transparent">
      <div className="flex min-h-14 items-center justify-end gap-2 px-3 py-2.5 sm:min-h-16 sm:gap-5 sm:px-4 md:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Offpay home"
          className="mr-auto flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hidden"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background sm:h-9 sm:w-9">
            <Image
              src={offpayAppIconPath}
              alt=""
              width={24}
              height={24}
              priority
              className="h-5 w-5 object-contain brightness-0 invert sm:h-6 sm:w-6"
              aria-hidden="true"
            />
          </span>
          <span className="hidden text-base font-bold sm:inline">Offpay</span>
        </Link>
        <div className="flex min-w-0 items-center gap-2 rounded-full backdrop-blur-md sm:gap-5">
          <SolPriceTicker />
          <WalletAccountControl />
        </div>
      </div>
    </header>
  );
}
