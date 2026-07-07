export type AppNavKey =
  | "home"
  | "vault"
  | "send"
  | "swap"
  | "history"
  | "perps"
  | "rwas"
  | "arcade";

export type AppNavHref =
  | "/"
  | "/vault"
  | "/send"
  | "/swap"
  | "/history"
  | "/perps"
  | "/rwas"
  | "/arcade";

export type AppNavItem = {
  key: AppNavKey;
  href: AppNavHref;
  label: string;
};

export type AppNavSection = {
  label: string;
  items: readonly AppNavItem[];
};

export const appNavSections = [
  {
    label: "Menu",
    items: [
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
    ],
  },
  {
    label: "Products",
    items: [
      {
        key: "perps",
        href: "/perps",
        label: "Perps",
      },
      {
        key: "rwas",
        href: "/rwas",
        label: "RWAs",
      },
      {
        key: "arcade",
        href: "/arcade",
        label: "Arcade",
      },
    ],
  },
] as const satisfies readonly AppNavSection[];

export const appNavItems: readonly AppNavItem[] = appNavSections.reduce<AppNavItem[]>(
  (items, section) => {
    items.push(...section.items);
    return items;
  },
  [],
);

export function isAppNavItemActive(pathname: string, href: AppNavHref): boolean {
  if (href === "/") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
