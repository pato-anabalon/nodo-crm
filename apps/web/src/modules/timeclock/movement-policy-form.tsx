"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/lib/use-action-toast";
import {
  RETURN_MINUTES_OPTIONS,
  SWITCH_MINUTES_OPTIONS,
  TRAVEL_MAX_MINUTES_OPTIONS,
  type MovementPolicy,
} from "@nodo/core/timeclock/movement";
import type { TimeclockState } from "./actions";

/**
 * What the clock does when somebody leaves the job mid-shift. Off by default:
 * a shift that ends by itself is a decision about people's pay, and each
 * company takes it for itself.
 */
export function MovementPolicyForm({
  policy,
  canEdit,
  save,
}: {
  policy: MovementPolicy;
  canEdit: boolean;
  save: (state: TimeclockState, formData: FormData) => Promise<TimeclockState>;
}) {
  const t = useTranslations("timeclockSettings");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState(save, {});
  useActionToast(state);
  const minutes = (value: number) => ({ value: String(value), label: t("minutes", { minutes: value }) });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("movement")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("movementHint")}</p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="returnMinutes">{t("returnMinutes")}</Label>
            <NativeSelect
              id="returnMinutes"
              name="returnMinutes"
              defaultValue={String(policy.returnMinutes)}
              disabled={!canEdit}
              options={RETURN_MINUTES_OPTIONS.map((value) => (value === 0 ? { value: "0", label: t("returnOff") } : minutes(value)))}
            />
            <p className="text-xs text-muted-foreground">{t("returnHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="switchMinutes">{t("switchMinutes")}</Label>
            <NativeSelect
              id="switchMinutes"
              name="switchMinutes"
              defaultValue={String(policy.switchMinutes)}
              disabled={!canEdit}
              options={SWITCH_MINUTES_OPTIONS.map(minutes)}
            />
            <p className="text-xs text-muted-foreground">{t("switchHint")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="travelMaxMinutes">{t("travelMax")}</Label>
            <NativeSelect
              id="travelMaxMinutes"
              name="travelMaxMinutes"
              defaultValue={String(policy.travelMaxMinutes)}
              disabled={!canEdit}
              options={TRAVEL_MAX_MINUTES_OPTIONS.map(minutes)}
            />
            <p className="text-xs text-muted-foreground">{t("travelHint")}</p>
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
