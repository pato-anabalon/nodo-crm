"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/lib/use-action-toast";
import { LOCATION_RETENTION_DAYS_OPTIONS } from "@nodo/core/timeclock/track";
import type { TimeclockState } from "./actions";

/**
 * How long the positions recorded during a shift are kept. Past it they
 * become one simplified line on the shift; the punches are never deleted.
 */
export function RetentionForm({
  days,
  canEdit,
  save,
}: {
  days: number;
  canEdit: boolean;
  save: (state: TimeclockState, formData: FormData) => Promise<TimeclockState>;
}) {
  const t = useTranslations("timeclockSettings");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState(save, {});
  useActionToast(state);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("retention")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("retentionHint")}</p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="retentionDays">{t("retentionDays")}</Label>
            <NativeSelect
              id="retentionDays"
              name="retentionDays"
              defaultValue={String(days)}
              disabled={!canEdit}
              options={LOCATION_RETENTION_DAYS_OPTIONS.map((value) => ({ value: String(value), label: t("days", { days: value }) }))}
            />
          </div>
          {canEdit ? (
            <div className="md:col-span-3">
              <Button type="submit" disabled={pending}>
                {pending ? tCommon("saving") : tCommon("saveChanges")}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
