"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/lib/use-action-toast";
import { addQuoteTypeAction, removeQuoteTypeAction, type SettingsState } from "./actions";

export type QuoteTypeRow = { id: string; label: string };

/**
 * The company's own list of document kinds — "Estimate For", "Quote For",
 * "Variation For", or whatever it wants to call what it sends.
 *
 * Added one at a time, same reason as a review link: a typo in the third one
 * is invisible in a comma-separated box, and this way each is checked on the
 * way in. Removing one never touches an existing quote — the text is already
 * frozen onto it, the same way the currency is — so there's nothing to confirm.
 */
export function QuoteTypesManager({
  types,
  canManage,
}: {
  types: QuoteTypeRow[];
  canManage: boolean;
}) {
  const t = useTranslations("settings.quoteTypes");
  const [state, formAction, adding] = useActionState<SettingsState, FormData>(
    addQuoteTypeAction,
    {},
  );
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useActionToast(state);

  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state]);

  function remove(id: string, label: string) {
    startTransition(async () => {
      const result = await removeQuoteTypeAction(id);
      if (result.error) toast.error(result.error);
      else toast.success(t("remove", { label }));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {types.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {types.map((type) => (
              <li key={type.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate text-sm">{type.label}</span>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => remove(type.id, type.label)}
                    aria-label={t("remove", { label: type.label })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-1 space-y-2">
              <Label htmlFor="quoteTypeLabel">{t("label")}</Label>
              <Input id="quoteTypeLabel" name="label" placeholder="Estimate For" />
              {state.fieldErrors?.label?.map((message) => (
                <p key={message} className="text-xs text-destructive">
                  {message}
                </p>
              ))}
            </div>

            <Button type="submit" disabled={adding}>
              {t("add")}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
