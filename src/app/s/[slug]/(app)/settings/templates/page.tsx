import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { can, requirePermission } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { listQuoteTemplates } from "@/modules/quote-templates/service";
import { TemplateManager } from "@/modules/quote-templates/template-manager";
import { SettingsHeader } from "@/modules/settings/settings-header";

export async function generateMetadata() {
  const t = await getTranslations("quoteTemplates");
  return { title: t("title") };
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePermission("settings.read");
  const t = await getTranslations("quoteTemplates");

  const raw = await searchParams;
  const includeRetired = (Array.isArray(raw.retired) ? raw.retired[0] : raw.retired) === "1";
  const templates = await listQuoteTemplates(ctx, includeRetired);

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("title")} subtitle={t("subtitle")} />

      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href={includeRetired ? "/settings/templates" : "/settings/templates?retired=1"}>
          {includeRetired ? t("hideRetired") : t("showRetired")}
        </Link>
      </Button>

      <TemplateManager
        canEdit={can(ctx, "settings.update")}
        templates={templates.map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          active: template.active,
          summary: t("summary", {
            lines: template._count.items,
            sections: template._count.sections,
          }),
        }))}
      />
    </div>
  );
}
