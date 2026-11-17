"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SearchCombobox, type SearchComboboxItem } from "@/components/search-combobox";

/**
 * Where a new quote starts from.
 *
 * Changing it reloads the page with the template in the URL rather than
 * rewriting the form in place: a half-filled quote silently replaced under
 * somebody's hands is worse than a navigation they can undo with the back
 * button.
 *
 * Searches the server instead of holding every template, same reasoning and
 * the same shared component as the quote form's lead and catalogue pickers.
 */
export function TemplatePicker({
  available,
  current,
  leadId,
  search,
}: {
  /** Whether the company has any template to offer at all. */
  available: boolean;
  current: { id: string; name: string } | null;
  leadId: string | null;
  /** A Server Action, passed down rather than imported here directly —
   * importing a `"use server"` module pulls in everything else it imports
   * too, which breaks this component's Jest tests even though it's harmless
   * in a real Next.js build. */
  search: (query: string) => Promise<SearchComboboxItem[]>;
}) {
  const t = useTranslations("quoteTemplates.picker");
  const router = useRouter();

  if (!available) return null;

  function choose(item: SearchComboboxItem | null) {
    const params = new URLSearchParams();
    if (leadId) params.set("leadId", leadId);
    if (item) params.set("template", item.id);
    router.push(`/quotes/new${params.size > 0 ? `?${params.toString()}` : ""}`);
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 pt-6">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="template">{t("label")}</Label>
          <SearchCombobox
            id="template"
            value={current ? { id: current.id, label: current.name } : null}
            onSelect={choose}
            search={search}
            placeholder={t("blank")}
            searchPlaceholder={t("search")}
            emptyLabel={t("empty")}
            noneLabel={t("blank")}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </CardContent>
    </Card>
  );
}
