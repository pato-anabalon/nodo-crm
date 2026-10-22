"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/lib/use-action-toast";
import { ROLE_NAME_MAX } from "./schemas";
import type { TeamState } from "./actions";

/**
 * What this company calls the profile.
 *
 * The standard name goes in the placeholder and never in the field: prefilling
 * it would turn the platform's wording into the company's own text the moment
 * they saved, and from then on it would sit out any improvement to it — and
 * stay in one language. Empty means "use the standard one".
 */
export function RoleNameForm({
  name,
  standardName,
  custom,
  canEdit,
  action,
}: {
  /** What the company set, or null when it still uses the standard name. */
  name: string | null;
  standardName: string;
  /** Made by the company: no standard name to fall back to, so it can't be emptied. */
  custom: boolean;
  canEdit: boolean;
  action: (prev: TeamState, formData: FormData) => Promise<TeamState>;
}) {
  const t = useTranslations("team.profiles");
  const [state, formAction, saving] = useActionState<TeamState, FormData>(action, {});
  useActionToast(state);

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="space-y-2">
          <Label htmlFor="name">{t("nameLabel")}</Label>

          {/* The button sits beside the field alone: with the hint inside the
              same row, `items-end` lined it up with the hint's baseline and left
              it floating below the input. */}
          <div className="flex items-center gap-3">
            <Input
              id="name"
              name="name"
              defaultValue={name ?? ""}
              placeholder={custom ? undefined : standardName}
              required={custom}
              maxLength={ROLE_NAME_MAX}
              disabled={!canEdit}
              className="flex-1"
            />
            {canEdit ? (
              <Button type="submit" disabled={saving}>
                {saving ? t("renaming") : t("rename")}
              </Button>
            ) : null}
          </div>

          {state.fieldErrors?.name ? (
            <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
          ) : custom ? null : (
            <p className="text-xs text-muted-foreground">{t("nameHint", { standard: standardName })}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
