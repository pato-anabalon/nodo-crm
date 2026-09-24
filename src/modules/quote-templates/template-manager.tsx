"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Archive, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteQuoteTemplateAction,
  renameQuoteTemplateAction,
  setQuoteTemplateActiveAction,
  type TemplateState,
} from "./actions";

export type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  summary: string;
};

/**
 * The company's templates.
 *
 * Only the name and the description are editable here. The content comes from
 * the quote it was saved off, and changing it means saving a new one — which
 * keeps this list a short catalogue of kinds of work rather than a second quote
 * editor to maintain.
 */
export function TemplateManager({ templates, canEdit }: { templates: TemplateRow[]; canEdit: boolean }) {
  const t = useTranslations("quoteTemplates");
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<TemplateState>) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-1 pt-6">
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
          <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("list")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {templates.map((template) =>
          editing === template.id ? (
            <div key={template.id} className="rounded-md border p-3">
              <NameForm
                action={renameQuoteTemplateAction.bind(null, template.id)}
                defaults={template}
                submitLabel={t("save")}
                onDone={() => setEditing(null)}
                onCancel={() => setEditing(null)}
              />
            </div>
          ) : (
            <div
              key={template.id}
              className="flex flex-wrap items-baseline justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {template.name}
                  {!template.active ? <Badge variant="secondary">{t("retiredBadge")}</Badge> : null}
                </p>
                {template.description ? (
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">{template.summary}</p>
              </div>

              {canEdit ? (
                <div className="flex flex-wrap gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(template.id)}>
                    <Pencil className="size-4" />
                    {t("rename")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => setQuoteTemplateActiveAction(template.id, !template.active))}
                  >
                    {template.active ? <Archive className="size-4" /> : <RotateCcw className="size-4" />}
                    {template.active ? t("retire") : t("restore")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => deleteQuoteTemplateAction(template.id))}
                  >
                    <Trash2 className="size-4" />
                    {t("delete")}
                  </Button>
                </div>
              ) : null}
            </div>
          ),
        )}
      </CardContent>
    </Card>
  );
}

export function NameForm({
  action,
  defaults,
  submitLabel,
  onDone,
  onCancel,
}: {
  action: (prev: TemplateState, formData: FormData) => Promise<TemplateState>;
  defaults?: { name: string; description: string | null };
  submitLabel: string;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("quoteTemplates.form");
  const [state, formAction, saving] = useActionState<TemplateState, FormData>(action, {});

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) {
      toast.success(state.message);
      onDone?.();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`name-${defaults?.name ?? "new"}`}>{t("name")}</Label>
          <Input
            id={`name-${defaults?.name ?? "new"}`}
            name="name"
            defaultValue={defaults?.name ?? ""}
            placeholder={t("namePlaceholder")}
            required
          />
          {state.fieldErrors?.name ? (
            <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`description-${defaults?.name ?? "new"}`}>{t("description")}</Label>
          <Input
            id={`description-${defaults?.name ?? "new"}`}
            name="description"
            defaultValue={defaults?.description ?? ""}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t("hint")}</p>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? t("saving") : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            <X className="size-4" />
            {t("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
