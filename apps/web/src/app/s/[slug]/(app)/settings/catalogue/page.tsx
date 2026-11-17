import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { can, requirePermission } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { catalogueFiltersFromParams } from "@/modules/catalogue/schemas";
import { listCatalogue } from "@/modules/catalogue/service";
import { CatalogueManager } from "@/modules/catalogue/catalogue-manager";
import { SettingsHeader } from "@/modules/settings/settings-header";

export async function generateMetadata() {
  const t = await getTranslations("catalogue");
  return { title: t("title") };
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePermission("settings.read");
  const [t, tCommon] = await Promise.all([
    getTranslations("catalogue"),
    getTranslations("common"),
  ]);

  const filters = catalogueFiltersFromParams(await searchParams);
  const items = await listCatalogue(ctx, filters);

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("title")} subtitle={t("subtitle")} />

      <form className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="max-w-xs"
        />
        {filters.includeRetired ? <input type="hidden" name="retired" value="1" /> : null}
        <Button type="submit" variant="secondary">
          {tCommon("search")}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={filters.includeRetired ? "/settings/catalogue" : "/settings/catalogue?retired=1"}>
            {filters.includeRetired ? t("hideRetired") : t("showRetired")}
          </Link>
        </Button>
      </form>

      <CatalogueManager
        canEdit={can(ctx, "settings.update")}
        items={items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          unit: item.unit,
          // The raw number for the form, the formatted one for the list: the
          // company's format belongs on screen, not in an editable field.
          unitPrice: String(Number(item.unitPrice)),
          priceLabel: formatMoney(
            Number(item.unitPrice),
            ctx.company.currency,
            ctx.company.formatLocale,
          ),
          active: item.active,
        }))}
      />
    </div>
  );
}
