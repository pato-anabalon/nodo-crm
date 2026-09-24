"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";

/**
 * Where a new quote starts from.
 *
 * Changing it reloads the page with the template in the URL rather than
 * rewriting the form in place: a half-filled quote silently replaced under
 * somebody's hands is worse than a navigation they can undo with the back
 * button.
 */
export function TemplatePicker({
  templates,
  current,
  leadId,
}: {
  templates: Array<{ id: string; name: string; description: string | null }>;
  current: string | null;
  leadId: string | null;
}) {
  const t = useTranslations("quoteTemplates.picker");
  const router = useRouter();

  if (templates.length === 0) return null;

  function choose(id: string) {
    const params = new URLSearchParams();
    if (leadId) params.set("leadId", leadId);
    if (id) params.set("template", id);
    router.push(`/quotes/new${params.size > 0 ? `?${params.toString()}` : ""}`);
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 pt-6">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="template">{t("label")}</Label>
          <NativeSelect
            id="template"
            value={current ?? ""}
            onChange={(event) => choose(event.target.value)}
            placeholder={t("blank")}
            options={templates.map((template) => ({
              value: template.id,
              label: template.name,
            }))}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </CardContent>
    </Card>
  );
}
