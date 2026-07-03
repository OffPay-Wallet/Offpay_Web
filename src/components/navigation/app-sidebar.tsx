"use client";

import {
  ArrowRightLeft,
  Clock3,
  Home,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

import { appNavItems, type AppNavKey, isAppNavItemActive } from "@/lib/offpay/navigation";
import { offpayAppIconPath } from "@/lib/offpay/public-config";
import { cn } from "@/lib/utils";

const navIconByKey: Record<AppNavKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  history: Clock3,
  home: Home,
  send: Send,
  swap: ArrowRightLeft,
  vault: WalletCards,
};

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="shrink-0 border-b border-border bg-card text-card-foreground md:h-full md:w-64 md:border-b-0 md:border-r">
      <div className="flex gap-3 overflow-x-auto px-4 py-3 md:flex-col md:overflow-visible md:p-4">
        <Link
          href="/"
          className="flex h-11 shrink-0 items-center gap-3 rounded-lg px-2 text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:mb-4"
        >
          <Image
            src={offpayAppIconPath}
            alt="Offpay app icon"
            width={32}
            height={32}
            priority
            className="h-8 w-8 rounded-md border border-border bg-background object-contain"
          />
          <span className="hidden text-base font-bold md:inline">Offpay</span>
        </Link>
        <nav aria-label="Primary" className="min-w-0 flex-1">
          <ul className="flex gap-1 md:flex-col">
            {appNavItems.map((item) => {
              const active = isAppNavItemActive(pathname, item.href);
              const Icon = navIconByKey[item.key];

              return (
                <li key={item.key} className="shrink-0 md:shrink">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold",
                      "transition-colors duration-150 focus-visible:outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="hidden rounded-lg border border-border bg-background p-3 text-xs leading-5 text-muted-foreground md:block">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Protected session
          </div>
          <p className="mt-1">Wallet actions stay review-first before any signature.</p>
        </div>
      </div>
    </aside>
  );
}
