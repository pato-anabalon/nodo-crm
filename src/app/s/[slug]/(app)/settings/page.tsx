import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  FileText,
  LayoutTemplate,
  Mail,
  Package,
  Plug,
  Shield,
  Star,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { settingsOverview } from "@/modules/settings/overview";
import { TEMPLATE_ORDER } from "@/modules/email-templates/kinds";

export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

type Entry = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  /** What is inside it, so the index says where there is work to do. */
  status: string;
  /** Empty reads as an invitation, not as a fault. */
  filled: boolean;
};

export default async function SettingsPage() {
  const ctx = await requirePermission("settings.read");
  const [t, tDocs, tApi, tReviews, tNotices, tTeam, tProfiles, tCatalogue, tTemplates, tEmails] =
    await Promise.all([
      getTranslations("settings"),
      getTranslations("documents"),
      getTranslations("ingest"),
      getTranslations("settings.reviews"),
      getTranslations("notificationSettings"),
      getTranslations("team"),
      getTranslations("team.profiles"),
      getTranslations("catalogue"),
      getTranslations("quoteTemplates"),
      getTranslations("emailTemplates"),
    ]);

  const has = await settingsOverview(ctx);
  const tState = await getTranslations("settings.state");

  /*
   * Four groups, because these are not ten peers: the company itself, what it
   * quotes with, what reaches the customer, and what connects to the outside.
   * Ten cards in a flat grid would be the old list with more air.
   */
  const groups: Array<{ label: string; items: Entry[] }> = [
    {
      label: t("groups.company"),
      items: [
        {
          href: "/settings/company",
          icon: Building2,
          title: t("profile.title"),
          description: t("profile.subtitle"),
          status: has.hasLogo
            ? tState("companyWithLogo", { name: has.companyName })
            : tState("companyNoLogo", { name: has.companyName }),
          filled: has.hasLogo,
        },
        {
          href: "/settings/team",
          icon: Users,
          title: tTeam("title"),
          description: tTeam("subtitle"),
          status: tState("team", { count: has.team }),
          filled: true,
        },
        {
          href: "/settings/profiles",
          icon: Shield,
          title: tProfiles("title"),
          description: tProfiles("subtitle"),
          status: tState("profiles", { count: has.profiles }),
          filled: true,
        },
      ],
    },
    {
      label: t("groups.quoting"),
      items: [
        {
          href: "/settings/catalogue",
          icon: Package,
          title: tCatalogue("title"),
          description: tCatalogue("subtitle"),
          status: tState("catalogue", { count: has.catalogue }),
          filled: has.catalogue > 0,
        },
        {
          href: "/settings/templates",
          icon: LayoutTemplate,
          title: tTemplates("title"),
          description: tTemplates("subtitle"),
          status: tState("quoteTemplates", { count: has.quoteTemplates }),
          filled: has.quoteTemplates > 0,
        },
        {
          href: "/settings/documents",
          icon: FileText,
          title: tDocs("title"),
          description: tDocs("subtitle"),
          status: tState("documents", { count: has.documents }),
          filled: has.documents > 0,
        },
      ],
    },
    {
      label: t("groups.customer"),
      items: [
        {
          href: "/settings/emails",
          icon: Mail,
          title: tEmails("title"),
          description: tEmails("subtitle"),
          // The only one where the total matters: three still unworded is not
          // something a bare count would say.
          status: tState("emailTemplates", {
            count: has.emailTemplates,
            total: TEMPLATE_ORDER.length,
          }),
          filled: has.emailTemplates > 0,
        },
        {
          href: "/settings/reviews",
          icon: Star,
          title: tReviews("title"),
          description: tReviews("subtitle"),
          status: tState("reviews", { count: has.reviews }),
          filled: has.reviews > 0,
        },
      ],
    },
    {
      label: t("groups.connections"),
      items: [
        {
          href: "/settings/api",
          icon: Plug,
          title: tApi("title"),
          description: tApi("subtitle"),
          status: tState("ingestKeys", { count: has.ingestKeys }),
          filled: has.ingestKeys > 0,
        },
      ],
    },
  ];

  /*
   * Apart, and said out loud.
   *
   * It is the only one of the ten that is not the company's decision but this
   * person's — the only one that needs no permission, because it is their own
   * email. Sitting it among company settings reads as if it were one more.
   */
  const mine: Entry = {
    href: "/settings/notifications",
    icon: Bell,
    title: tNotices("title"),
    description: tNotices("subtitle", { company: has.companyName }),
    status: tState("notices", { count: has.mutedNotices }),
    filled: true,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {groups.map((group) => (
        <Group key={group.label} label={group.label}>
          {group.items.map((entry) => (
            <SettingCard key={entry.href} entry={entry} />
          ))}
        </Group>
      ))}

      <Group label={t("groups.mine")}>
        <SettingCard entry={mine} dashed />
      </Group>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-mono text-[0.65rem] tracking-wider text-muted-foreground uppercase">
        {label}
      </h2>
      {/*
        `auto-fit` rather than a column count: three across on a desktop, two on
        a tablet, one on a phone, with no breakpoints to maintain.
      */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function SettingCard({ entry, dashed }: { entry: Entry; dashed?: boolean }) {
  const Icon = entry.icon;

  return (
    <Link
      href={entry.href}
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors",
        "hover:border-foreground/20 hover:shadow-sm",
        dashed && "border-dashed",
      )}
    >
      <span className="flex items-center gap-2.5">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium">{entry.title}</span>
      </span>

      <p className="text-xs leading-relaxed text-muted-foreground">{entry.description}</p>

      <span
        className={cn(
          "mt-auto border-t pt-2 text-xs",
          entry.filled ? "font-medium text-foreground" : "text-muted-foreground italic",
        )}
      >
        {entry.status}
      </span>
    </Link>
  );
}
