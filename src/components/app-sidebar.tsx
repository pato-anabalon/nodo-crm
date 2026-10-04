"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Building2,
  ChartLine,
  Contact,
  CircleCheck,
  FileText,
  Gauge,
  Loader2,
  Menu,
  Settings,
  Users,
} from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { isNavItemActive, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const ICONS = {
  gauge: Gauge,
  users: Users,
  "file-text": FileText,
  contact: Contact,
  building: Building2,
  check: CircleCheck,
  chart: ChartLine,
  settings: Settings,
} as const;

type SidebarProps = {
  companyName: string;
  logoUrl: string | null;
  items: NavItem[];
};

function SidebarBrand({ companyName, logoUrl }: Omit<SidebarProps, "items">) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
      <CompanyLogo name={companyName} logoUrl={logoUrl} size="sm" />
      <span className="truncate text-sm font-semibold">{companyName}</span>
    </div>
  );
}

/**
 * Must be a child of the `Link` it reports on — `useLinkStatus` reads the
 * nearest one's pending state, not whichever link happens to be on screen.
 * The spinner is the only sign a click did anything until the segment's own
 * `loading.tsx` takes over.
 */
function NavLinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Loader2 className="ml-auto size-3.5 shrink-0 animate-spin" />;
}

function SidebarLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isNavItemActive(item, pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {t(item.labelKey)}
            <NavLinkPending />
          </Link>
        );
      })}
    </nav>
  );
}

export function AppSidebar({ companyName, logoUrl, items }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="no-print hidden h-full w-60 shrink-0 flex-col border-r bg-background md:flex">
      <SidebarBrand companyName={companyName} logoUrl={logoUrl} />
      <SidebarLinks items={items} pathname={pathname} />
    </aside>
  );
}

/**
 * The same nav, reached from a hamburger in the header on narrow screens
 * instead of the `aside`, which `AppSidebar` keeps hidden below `md`. It
 * closes itself on navigation: the sheet sits in the layout, which persists
 * across route changes, so nothing else would close it.
 */
export function MobileNav({ companyName, logoUrl, items }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="no-print md:hidden">
          <Menu className="size-4" />
          <span className="sr-only">{t("openMenu")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetTitle className="sr-only">{companyName}</SheetTitle>
        <SidebarBrand companyName={companyName} logoUrl={logoUrl} />
        <SidebarLinks
          items={items}
          pathname={pathname}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
