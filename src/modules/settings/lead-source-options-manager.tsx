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
import { addLeadSourceOptionAction, removeLeadSourceOptionAction, type SettingsState } from "./actions";

export type LeadSourceOptionRow = { id: string; label: string };

/**
 * What a lead's source says under "Other" — a billboard, a home show, a
 * supplier's referral. Added one at a time, like the quote types, and a lead
 * keeps the text it was given, so removing one never rewrites a lead.
 */
export function LeadSourceOptionsManager({
  options,
  canManage,
}: {
  options: LeadSourceOptionRow[];
  canManage: boolean;
}) {
  const t = useTranslations("settings.leadSources");
  const [state, formAction, adding] = useActionState<SettingsState, FormData>(
    addLeadSourceOptionAction,
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
      const result = await removeLeadSourceOptionAction(id);
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
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {options.map((option) => (
              <li key={option.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate text-sm">{option.label}</span>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => remove(option.id, option.label)}
                    aria-label={t("remove", { label: option.label })}
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
              <Label htmlFor="leadSourceLabel">{t("label")}</Label>
              <Input id="leadSourceLabel" name="label" placeholder="Home show" />
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
