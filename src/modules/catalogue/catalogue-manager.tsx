"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Archive, Pencil, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCatalogueItemAction,
  setCatalogueItemActiveAction,
  updateCatalogueItemAction,
  type CatalogueState,
} from "./actions";

export type CatalogueRow = {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  unitPrice: string;
  priceLabel: string;
  active: boolean;
};

/**
 * The company's price list.
 *
 * Editing happens in place: the list is short and the fields are few, so sending
 * somebody to another page to change a price would cost more than it saves.
 */
export function CatalogueManager({
  items,
  canEdit,
}: {
  items: CatalogueRow[];
  canEdit: boolean;
}) {
  const t = useTranslations("catalogue");
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      const result = await setCatalogueItemActiveAction(id, active);
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  return (
    <div className="space-y-6">
      {canEdit ? <ItemForm action={createCatalogueItemAction} title={t("add.title")} submitLabel={t("add.button")} resetOnDone /> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("list")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            items.map((item) =>
              editing === item.id ? (
                <div key={item.id} className="rounded-md border p-3">
                  <ItemForm
                    action={updateCatalogueItemAction.bind(null, item.id)}
                    title={t("edit.title")}
                    submitLabel={t("edit.button")}
                    defaults={item}
                    onDone={() => setEditing(null)}
                    onCancel={() => setEditing(null)}
                    bare
                  />
                </div>
              ) : (
                <div
                  key={item.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {item.name}
                      {!item.active ? (
                        <Badge variant="secondary">{t("retiredBadge")}</Badge>
                      ) : null}
                    </p>
                    {item.description ? (
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    ) : null}
                  </div>

                  <span className="text-sm tabular-nums">
                    {item.priceLabel}
                    {item.unit ? (
                      <span className="text-muted-foreground"> / {item.unit}</span>
                    ) : null}
                  </span>

                  {canEdit ? (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(item.id)}>
                        <Pencil className="size-4" />
                        {t("edit.button")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => toggle(item.id, !item.active)}
                      >
                        {item.active ? <Archive className="size-4" /> : <RotateCcw className="size-4" />}
                        {item.active ? t("retire") : t("restore")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ),
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ItemForm({
  action,
  title,
  submitLabel,
  defaults,
  resetOnDone,
  onDone,
  onCancel,
  bare,
}: {
  action: (prev: CatalogueState, formData: FormData) => Promise<CatalogueState>;
  title: string;
  submitLabel: string;
  defaults?: CatalogueRow;
  resetOnDone?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
  bare?: boolean;
}) {
  const t = useTranslations("catalogue.form");
  const [state, formAction, saving] = useActionState<CatalogueState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) {
      toast.success(state.message);
      if (resetOnDone) formRef.current?.reset();
      onDone?.();
    }
  }, [state, resetOnDone, onDone]);

  const body = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`name-${defaults?.id ?? "new"}`}>{t("name")}</Label>
          <Input
            id={`name-${defaults?.id ?? "new"}`}
            name="name"
            defaultValue={defaults?.name ?? ""}
            required
          />
          {state.fieldErrors?.name ? (
            <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`unitPrice-${defaults?.id ?? "new"}`}>{t("unitPrice")}</Label>
          <Input
            id={`unitPrice-${defaults?.id ?? "new"}`}
            name="unitPrice"
            inputMode="decimal"
            defaultValue={defaults?.unitPrice ?? ""}
            required
          />
          {state.fieldErrors?.unitPrice ? (
            <p className="text-sm text-destructive">{state.fieldErrors.unitPrice[0]}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`unit-${defaults?.id ?? "new"}`}>{t("unit")}</Label>
          <Input
            id={`unit-${defaults?.id ?? "new"}`}
            name="unit"
            placeholder={t("unitPlaceholder")}
            defaultValue={defaults?.unit ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`description-${defaults?.id ?? "new"}`}>{t("description")}</Label>
        <Textarea
          id={`description-${defaults?.id ?? "new"}`}
          name="description"
          rows={2}
          defaultValue={defaults?.description ?? ""}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? t("saving") : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            <X className="size-4" />
            {t("cancel")}
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (bare) {
    return (
      <form ref={formRef} action={formAction}>
        {body}
      </form>
    );
  }

  return (
    <form ref={formRef} action={formAction}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
    </form>
  );
}
