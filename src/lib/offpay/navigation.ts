export type AppNavKey = "home" | "vault" | "send" | "swap" | "history";

export type AppNavHref = "/" | "/vault" | "/send" | "/swap" | "/history";

export type AppNavItem = {
  key: AppNavKey;
  href: AppNavHref;
  label: string;
};

export const appNavItems = [
  {
    key: "home",
    href: "/",
    label: "Home",
  },
  {
    key: "vault",
    href: "/vault",
    label: "Vault",
  },
  {
    key: "send",
    href: "/send",
    label: "Send",
  },
  {
    key: "swap",
    href: "/swap",
    label: "Swap",
  },
  {
    key: "history",
    href: "/history",
    label: "History",
  },
] as const satisfies readonly AppNavItem[];

export function isAppNavItemActive(pathname: string, href: AppNavHref): boolean {
  if (href === "/") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
