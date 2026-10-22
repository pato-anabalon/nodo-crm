"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/lib/use-action-toast";
import { ROLE_NAME_MAX } from "./schemas";
import type { TeamState } from "./actions";

/**
 * Makes a profile of the company's own.
 *
 * It starts as a copy of another profile by default, because the usual case is
 * "like Sales, with a few ticks moved" and a blank grid of every feature is not
 * somewhere anybody wants to begin. On success the action sends the person to
 * the new profile's features, so there is no message to show here.
 */
export function NewRoleForm({
  roles,
  defaultCopyFrom,
  action,
}: {
  roles: { id: string; label: string }[];
  defaultCopyFrom: string;
  action: (prev: TeamState, formData: FormData) => Promise<TeamState>;
}) {
  const t = useTranslations("team.profiles");
  const [state, formAction, creating] = useActionState<TeamState, FormData>(action, {});
  useActionToast(state);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("newTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("newSubtitle")}</p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-wrap items-start gap-3">
          <div className="min-w-56 flex-1 space-y-2">
            <Label htmlFor="newRoleName">{t("nameLabel")}</Label>
            <Input id="newRoleName" name="name" required maxLength={ROLE_NAME_MAX} />
            {state.fieldErrors?.name ? (
              <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="copyFrom">{t("copyFrom")}</Label>
            <NativeSelect
              id="copyFrom"
              name="copyFrom"
              defaultValue={defaultCopyFrom}
              options={[
                { value: "", label: t("copyNothing") },
                ...roles.map((role) => ({ value: role.id, label: role.label })),
              ]}
            />
          </div>

          <Button type="submit" disabled={creating} className="self-end">
            {creating ? t("creating") : t("create")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
