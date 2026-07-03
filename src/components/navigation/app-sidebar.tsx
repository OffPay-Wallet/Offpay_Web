"use client";

import {
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Home,
  Send,
  WalletCards,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type SVGProps } from "react";

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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "offpay-liquid-glass relative isolate w-full shrink-0 overflow-hidden rounded-2xl text-card-foreground",
        "transition-[width] duration-200 motion-reduce:transition-none md:h-full",
        collapsed ? "md:w-24" : "md:w-64",
      )}
    >
      <div
        className={cn(
          "relative z-10 flex min-h-0 gap-3 overflow-x-auto px-4 py-3 md:h-full md:flex-col md:overflow-hidden md:p-4",
          collapsed && "md:px-1",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-3 md:border-b md:border-border/70 md:pb-4",
            collapsed ? "md:justify-center md:gap-1" : "md:justify-between",
          )}
        >
          <Link
            href="/"
            className={cn(
              "flex h-11 min-w-0 shrink-0 items-center gap-3 rounded-lg px-2 text-foreground",
              "transition-colors hover:text-foreground focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
              "motion-reduce:transition-none",
              collapsed && "md:w-11 md:justify-center md:px-0",
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
              <Image
                src={offpayAppIconPath}
                alt="Offpay app icon"
                width={28}
                height={28}
                priority
                className="h-7 w-7 object-contain brightness-0 invert"
              />
            </span>
            <span
              className={cn(
                "hidden min-w-0 truncate text-base font-bold md:inline",
                collapsed && "md:sr-only",
              )}
            >
              Offpay
            </span>
          </Link>
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="hidden h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transition-none md:inline-flex"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <p
          className={cn(
            "hidden px-3 pt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70 md:block",
            collapsed && "md:hidden",
          )}
        >
          Menu
        </p>
        <nav aria-label="Primary" className="min-w-0 flex-1">
          <ul className={cn("flex gap-1 md:flex-col md:gap-2", collapsed && "md:items-center")}>
            {appNavItems.map((item) => {
              const active = isAppNavItemActive(pathname, item.href);
              const Icon = navIconByKey[item.key];

              return (
                <li key={item.key} className="shrink-0 md:w-full md:shrink">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold",
                      "transition-colors duration-150 focus-visible:outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "focus-visible:ring-offset-card hover:text-foreground motion-reduce:transition-none",
                      collapsed && "md:justify-center md:px-0",
                      active && "offpay-sidebar-link-active rounded-none",
                      active &&
                        !collapsed &&
                        "md:-mx-4 md:w-[calc(100%+2rem)] md:px-7",
                      active && collapsed && "md:-mx-1 md:w-[calc(100%+0.5rem)]",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className={cn("whitespace-nowrap", collapsed && "md:sr-only")}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
