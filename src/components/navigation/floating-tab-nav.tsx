"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { appNavItems, isAppNavItemActive } from "@/lib/offpay/navigation";
import { cn } from "@/lib/utils";

export function FloatingTabNav() {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-3">
      <nav
        aria-label="Primary"
        className="pointer-events-auto w-[min(calc(100vw-1.5rem),35rem)] rounded-full border-2 border-foreground bg-background/95 p-1 shadow-lg backdrop-blur"
      >
        <ul className="grid grid-cols-5 gap-1">
          {appNavItems.map((item) => {
            const active = isAppNavItemActive(pathname, item.href);

            return (
              <li key={item.key} className="min-w-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 min-w-0 items-center justify-center rounded-full px-2 text-center text-[11px] font-bold uppercase tracking-normal transition-colors sm:text-sm",
                    active
                      ? "bg-foreground text-background"
                      : "text-foreground hover:bg-secondary",
                  )}
                >
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
