"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/lib/use-action-toast";
import { MEAL_BREAK_OPTIONS, REST_BREAK_OPTIONS, type BreakPolicy } from "@nodo/core/timeclock/pay";
import type { TimeclockState } from "./actions";

/**
 * How long the company's breaks last. The table of which breaks a day carries
 * is shown beside it, read-only, because that part is the law's: what a
 * company decides is only how generous each one is.
 */
export function BreakPolicyForm({
  policy,
  canEdit,
  save,
}: {
  policy: BreakPolicy;
  canEdit: boolean;
  save: (state: TimeclockState, formData: FormData) => Promise<TimeclockState>;
}) {
  const t = useTranslations("timeclockSettings");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState(save, {});
  useActionToast(state);

  const rows = [
    { worked: t("law.under2"), breaks: t("law.none") },
    { worked: t("law.from2to4"), breaks: t("law.rest", { count: 1 }) },
    { worked: t("law.over4to6"), breaks: t("law.restAndMeal", { count: 1 }) },
    { worked: t("law.over6under10"), breaks: t("law.restAndMeal", { count: 2 }) },
    { worked: t("law.from10"), breaks: t("law.restAndMeal", { count: 3 }) },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("breaks")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("breaksHint")}</p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="restBreakMinutes">{t("rest")}</Label>
              <NativeSelect
                id="restBreakMinutes"
                name="restBreakMinutes"
                defaultValue={String(policy.restBreakMinutes)}
                disabled={!canEdit}
                options={REST_BREAK_OPTIONS.map((minutes) => ({ value: String(minutes), label: t("minutes", { minutes }) }))}
              />
              <p className="text-xs text-muted-foreground">{t("restHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mealBreakMinutes">{t("meal")}</Label>
              <NativeSelect
                id="mealBreakMinutes"
                name="mealBreakMinutes"
                defaultValue={String(policy.mealBreakMinutes)}
                disabled={!canEdit}
                options={MEAL_BREAK_OPTIONS.map((minutes) => ({
                  value: String(minutes),
                  label: minutes === 0 ? t("mealPaid") : t("minutes", { minutes }),
                }))}
              />
              <p className="text-xs text-muted-foreground">{t("mealHint")}</p>
            </div>
            {canEdit ? (
              <Button type="submit" disabled={pending}>
                {pending ? tCommon("saving") : tCommon("saveChanges")}
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("law.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("law.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <dl className="divide-y text-sm">
            {rows.map((row) => (
              <div key={row.worked} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                <dt className="font-medium">{row.worked}</dt>
                <dd className="text-muted-foreground">{row.breaks}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
