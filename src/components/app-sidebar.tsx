"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, ChartLine, Contact, CircleCheck, FileText, Gauge, Settings, Users } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { isNavItemActive, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

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

export function AppSidebar({
  companyName,
  logoUrl,
  items,
}: {
  companyName: string;
  logoUrl: string | null;
  items: NavItem[];
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <aside className="no-print hidden h-full w-60 shrink-0 flex-col border-r bg-background md:flex">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
        <CompanyLogo name={companyName} logoUrl={logoUrl} size="sm" />
        <span className="truncate text-sm font-semibold">{companyName}</span>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isNavItemActive(item, pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
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
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
