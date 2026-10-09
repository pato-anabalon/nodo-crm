"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActionToast } from "@/lib/use-action-toast";
import { updateProfileAction, type AccountState } from "./actions";

/**
 * Just the name — everywhere that would otherwise read as the signed-in
 * person's email, the way a freshly-invited user who joined straight from
 * `/join/<token>` and never typed a name had no way to fix before this.
 */
export function ProfileForm({ name }: { name: string | null }) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState<AccountState, FormData>(updateProfileAction, {});
  useActionToast(state);

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{t("nameTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("nameSubtitle")}</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-2">
            <Label htmlFor="name">{t("nameLabel")}</Label>
            <Input id="name" name="name" required defaultValue={name ?? ""} placeholder="Jane Doe" />
            {state.fieldErrors?.name?.length ? (
              <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
            ) : null}
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
