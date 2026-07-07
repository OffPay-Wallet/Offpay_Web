"use client";

import { ArrowRightLeft, Clock3, Home, Send, WalletCards } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType, type SVGProps, useEffect, useState } from "react";

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

// Panel width (md+). Fully retracted off-screen; revealed by cursor proximity.
const PANEL_WIDTH = "16rem";
const PANEL_PX = 256;
// How close (px) the cursor must get to the left edge to reveal the panel.
const REVEAL_ZONE_PX = 56;
// Once revealed, keep it open until the cursor moves past the panel (plus the
// shell's left padding and a small comfort buffer).
const CLOSE_ZONE_PX = PANEL_PX + 48;

/**
 * Tracks whether the cursor is near the left edge (desktop only). Opens when the
 * pointer enters the reveal zone; stays open while it hovers the panel; closes
 * once it moves past the panel or leaves the window. Hysteresis (open zone vs.
 * close boundary differ) prevents flicker at the threshold.
 */
function useEdgeProximity(): readonly [boolean, (value: boolean) => void] {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");

    const handleMove = (event: MouseEvent) => {
      if (!desktop.matches) return;
      if (event.clientX <= REVEAL_ZONE_PX) {
        setRevealed(true);
      } else if (event.clientX > CLOSE_ZONE_PX) {
        setRevealed(false);
      }
    };
    const handleLeave = () => setRevealed(false);

    window.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return [revealed, setRevealed] as const;
}

export function AppSidebar() {
  const pathname = usePathname();
  const [revealed, setRevealed] = useEdgeProximity();

  return (
    <aside
      aria-label="Primary"
      className={cn(
        // Mobile: a normal full-width bottom bar in flow.
        // md+: an in-flow rail whose width animates between 0 and the panel
        // width, so the main content reflows smoothly instead of being covered.
        // z-40 keeps the rail above any full-screen page background (e.g. the
        // vault matrix overlay) so glyphs never paint over the chrome.
        // md+: reserves no layout width — the panel is an overlay — so the main
        // content never shifts when the rail reveals over the empty margin.
        "relative z-40 w-full shrink-0",
        "md:h-full md:w-0",
      )}
      style={{ ["--sidebar-w" as string]: PANEL_WIDTH }}
    >
      <div
        // Opaque base colour sits under the liquid-glass gradient layers (which
        // are all semi-transparent) so the panel never reveals the page
        // background — e.g. the full-screen matrix rain — through the glass.
        style={{ backgroundColor: "var(--offpay-color-night)" }}
        className={cn(
          "offpay-liquid-glass relative isolate w-full overflow-hidden rounded-2xl text-card-foreground",
          // md+: overlay panel that slides in from the left over the empty
          // margin, revealed on cursor proximity or keyboard focus. Transform-
          // only transition keeps it smooth and never reflows the main content.
          "md:absolute md:inset-y-0 md:left-0 md:h-full md:w-[var(--sidebar-w)]",
          "md:will-change-transform md:transition-transform md:duration-200 md:ease-out md:motion-reduce:transition-none",
          // Retract fully off-screen. The rail starts inside the shell's p-4
          // padding, so translating only its own width leaves a ~16px sliver;
          // the extra offset (plus buffer for the glass glow) clears it.
          revealed ? "md:translate-x-0" : "md:-translate-x-[calc(100%+2rem)]",
          "md:has-[:focus-visible]:translate-x-0",
        )}
      >
        <div className="relative z-10 flex min-h-0 gap-3 overflow-x-auto px-3 py-2 md:h-full md:flex-col md:overflow-hidden md:p-4">
          <div className="hidden shrink-0 items-center md:flex md:border-b md:border-border/70 md:pb-4">
            <Link
              href="/"
              aria-label="Offpay home"
              className={cn(
                "flex h-11 min-w-0 shrink-0 items-center gap-3 rounded-lg px-2 text-foreground",
                "transition-colors hover:text-foreground focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                "motion-reduce:transition-none",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                <Image
                  src={offpayAppIconPath}
                  alt=""
                  width={28}
                  height={28}
                  priority
                  className="h-7 w-7 object-contain brightness-0 invert"
                  aria-hidden="true"
                />
              </span>
              <span className="min-w-0 truncate text-base font-bold">Offpay</span>
            </Link>
          </div>
          <p className="hidden px-3 pt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70 md:block">
            Menu
          </p>
          <nav aria-label="Primary" className="min-w-0 flex-1">
            <ul className="flex justify-around gap-1 md:flex-col md:justify-normal md:gap-2">
              {appNavItems.map((item) => {
                const active = isAppNavItemActive(pathname, item.href);
                const Icon = navIconByKey[item.key];

                return (
                  <li key={item.key} className="shrink-0 md:w-full md:shrink">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      aria-label={item.label}
                      onClick={() => setRevealed(false)}
                      className={cn(
                        "flex h-11 w-full items-center justify-center gap-3 rounded-lg px-3 text-sm font-semibold",
                        "transition-colors duration-150 focus-visible:outline-none md:justify-start",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "focus-visible:ring-offset-card hover:text-foreground motion-reduce:transition-none",
                        active && "offpay-sidebar-link-active",
                        active ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="hidden whitespace-nowrap md:inline">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </aside>
  );
}
