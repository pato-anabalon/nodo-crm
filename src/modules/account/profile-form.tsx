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
 * The name — everywhere that would otherwise read as the signed-in person's
 * email, the way a freshly-invited user who joined straight from
 * `/join/<token>` and never typed a name had no way to fix before this — and
 * the job title the customer reads under it on every quote this person
 * writes. Both optional fields can be cleared, which takes the line off the
 * quote rather than leaving it blank.
 */
export function ProfileForm({
  name,
  jobTitle,
  phone,
}: {
  name: string | null;
  jobTitle: string | null;
  phone: string | null;
}) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState<AccountState, FormData>(updateProfileAction, {});
  useActionToast(state);

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{t("detailsTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("detailsSubtitle")}</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input id="name" name="name" required defaultValue={name ?? ""} placeholder="Jane Doe" />
              {state.fieldErrors?.name?.length ? (
                <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">{t("jobTitleLabel")}</Label>
              <Input
                id="jobTitle"
                name="jobTitle"
                maxLength={80}
                defaultValue={jobTitle ?? ""}
                placeholder={t("jobTitlePlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("jobTitleHint")}</p>
              {state.fieldErrors?.jobTitle?.length ? (
                <p className="text-sm text-destructive">{state.fieldErrors.jobTitle[0]}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("phoneLabel")}</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                maxLength={60}
                defaultValue={phone ?? ""}
              />
              <p className="text-xs text-muted-foreground">{t("phoneHint")}</p>
              {state.fieldErrors?.phone?.length ? (
                <p className="text-sm text-destructive">{state.fieldErrors.phone[0]}</p>
              ) : null}
            </div>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
