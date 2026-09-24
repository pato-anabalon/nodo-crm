"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { TeamState } from "./actions";

export type ModuleGroup = {
  module: string;
  label: string;
  permissions: { key: string; label: string }[];
};

/**
 * The grid where a profile's features are ticked.
 *
 * The whole set is submitted every time, so what is stored is exactly what was
 * on screen — a partial update would let the two drift the moment two people
 * edited the same profile.
 *
 * Checkbox state is held here rather than left to the DOM because shadcn's
 * checkbox is a button underneath and submits nothing on its own; the hidden
 * inputs are what the form actually sends.
 */
export function PermissionGrid({
  groups,
  granted,
  editable,
  canEdit,
  action,
}: {
  groups: ModuleGroup[];
  granted: string[];
  editable: boolean;
  canEdit: boolean;
  action: (prev: TeamState, formData: FormData) => Promise<TeamState>;
}) {
  const t = useTranslations("team");
  const [state, formAction, saving] = useActionState<TeamState, FormData>(action, {});
  const [checked, setChecked] = useState<Set<string>>(() => new Set(granted));

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) toast.success(state.message);
  }, [state]);

  function toggle(key: string, on: boolean) {
    setChecked((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  const locked = !editable || !canEdit;

  return (
    <form action={formAction} className="space-y-6">
      {[...checked].map((key) => (
        <input key={key} type="hidden" name="permissions" value={key} />
      ))}

      {locked ? (
        <p className="text-sm text-muted-foreground">
          {editable ? t("errors.noPermission") : t("errors.ownerLocked")}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.module}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{group.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {group.permissions.map((permission) => (
                <div
                  key={permission.key}
                  className="group flex items-start gap-2.5"
                  // `Label` dims on `peer-disabled`, which needs the checkbox to
                  // be its own previous sibling; it now sits inside the wrapper
                  // that positions its hidden input. The row says it instead,
                  // through the `group-data-[disabled=true]` that `Label`
                  // already carries.
                  data-disabled={locked ? "true" : undefined}
                >
                  <Checkbox
                    id={permission.key}
                    checked={checked.has(permission.key)}
                    disabled={locked}
                    onCheckedChange={(value) => toggle(permission.key, value === true)}
                  />
                  <Label htmlFor={permission.key} className="text-sm leading-tight font-normal">
                    {permission.label}
                  </Label>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {!locked ? (
        <Button type="submit" disabled={saving}>
          {saving ? t("saving") : t("saveProfile")}
        </Button>
      ) : null}
    </form>
  );
}
