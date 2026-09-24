import type { Permission } from "@/lib/auth/permissions";

export type NavItem = {
  href: string;
  /** Key under `nav.*` in the message file; the text is translated on render. */
  labelKey: "dashboard" | "leads" | "quotes" | "contacts" | "clients" | "tasks" | "reports" | "settings";
  icon: "gauge" | "users" | "file-text" | "contact" | "building" | "check" | "chart" | "settings";
  /** Minimum permission for the item to appear in the menu. */
  permission?: Permission;
  /**
   * A module that has no screen yet. It stays declared so the menu order isn't
   * lost, but it isn't shown: a link that leads to a 404 is worse than absent.
   */
  pending?: true;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", labelKey: "dashboard", icon: "gauge" },
  { href: "/leads", labelKey: "leads", icon: "users", permission: "leads.read" },
  { href: "/quotes", labelKey: "quotes", icon: "file-text", permission: "quotes.read" },
  { href: "/contacts", labelKey: "contacts", icon: "contact", permission: "contacts.read" },
  { href: "/clients", labelKey: "clients", icon: "building", permission: "contacts.read" },
  { href: "/tasks", labelKey: "tasks", icon: "check", permission: "leads.read" },
  { href: "/reports", labelKey: "reports", icon: "chart", permission: "reports.read" },
  { href: "/settings", labelKey: "settings", icon: "settings", permission: "settings.read" },
] as const;

export function visibleNavItems(permissions: Set<Permission>): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.pending && (!item.permission || permissions.has(item.permission)),
  );
}

/** The active item is the most specific route that matches the current one. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
