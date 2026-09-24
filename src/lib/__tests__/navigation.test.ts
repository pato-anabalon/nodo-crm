import { existsSync } from "node:fs";

import { isNavItemActive, NAV_ITEMS, visibleNavItems } from "../navigation";
import type { Permission } from "../auth/permissions";

const perms = (...list: Permission[]) => new Set<Permission>(list);

describe("visibleNavItems", () => {
  it("always shows the overview, which requires no permission", () => {
    expect(visibleNavItems(perms()).map((i) => i.href)).toEqual(["/"]);
  });

  it("shows only the permitted modules", () => {
    const items = visibleNavItems(perms("leads.read", "quotes.read"));
    expect(items.map((i) => i.href)).toEqual(["/", "/leads", "/quotes", "/tasks"]);
  });

  it("hides settings from a sales profile", () => {
    const hrefs = visibleNavItems(perms("leads.read", "quotes.read", "contacts.read")).map((i) => i.href);
    expect(hrefs).not.toContain("/settings");
  });

  /**
   * The team screen is a settings screen and reaches the menu through Settings,
   * like the other nine. It had a second door of its own in the sidebar, which
   * is the one thing the settings index was rebuilt to stop needing.
   */
  it("gives the menu one door per module", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(hrefs.filter((href) => href.startsWith("/settings"))).toEqual(["/settings"]);
  });

  it("every item declares a known permission or none", () => {
    for (const item of NAV_ITEMS) {
      if (item.permission) expect(typeof item.permission).toBe("string");
    }
  });
});

describe("isNavItemActive", () => {
  const leads = { href: "/leads", labelKey: "leads", icon: "users" } as const;
  const home = { href: "/", labelKey: "dashboard", icon: "gauge" } as const;

  it("marks the module and its subroutes as active", () => {
    expect(isNavItemActive(leads, "/leads")).toBe(true);
    expect(isNavItemActive(leads, "/leads/abc123")).toBe(true);
    expect(isNavItemActive(leads, "/leads/new")).toBe(true);
  });

  it("does not mark a module active that merely shares a prefix", () => {
    expect(isNavItemActive(leads, "/leads-antiguos")).toBe(false);
  });

  it("the overview is only active at the exact root", () => {
    expect(isNavItemActive(home, "/")).toBe(true);
    expect(isNavItemActive(home, "/leads")).toBe(false);
  });
});

describe("every menu item leads somewhere", () => {
  /**
   * Checked against the file system rather than against a list kept by hand.
   *
   * `/equipo` and `/contactos` sat in this menu for weeks pointing at routes
   * that were never built, and nothing failed — the only thing that would have
   * caught it is asking the app directory whether the page exists.
   */
  const ROUTES = "src/app/s/[slug]/(app)";

  const pageFor = (href: string) => {
    const segments = href.split("/").filter(Boolean);
    return [ROUTES, ...segments, "page.tsx"].join("/");
  };

  it.each(NAV_ITEMS.map((item) => [item.href, pageFor(item.href)]))(
    "%s has a page at %s",
    (_href, file) => {
      expect(existsSync(file)).toBe(true);
    },
  );

  it("every visible item declares an absolute route", () => {
    for (const item of NAV_ITEMS) {
      expect(item.href.startsWith("/")).toBe(true);
    }
  });
});
