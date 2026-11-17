"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addLeadRecipientAction,
  removeLeadRecipientAction,
  type RecipientState,
} from "./actions";

/**
 * Who else gets the "new lead" notice.
 *
 * One address at a time, each checked as it goes in and removable on its own —
 * rather than a comma-separated box, where a typo in the third address is
 * invisible until somebody notices the notices stopped arriving.
 */
export function LeadRecipients({
  emails,
  canEdit,
}: {
  emails: string[];
  canEdit: boolean;
}) {
  const t = useTranslations("notificationSettings.recipients");
  const [state, formAction, adding] = useActionState<RecipientState, FormData>(
    addLeadRecipientAction,
    {},
  );
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);

  function remove(email: string) {
    startTransition(async () => {
      const result = await removeLeadRecipientAction(email);
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {emails.map((email) => (
              <li
                key={email}
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <Mail className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{email}</span>
                </span>

                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending || adding}
                    onClick={() => remove(email)}
                  >
                    <Trash2 className="size-4" />
                    {t("remove")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="email">{t("add")}</Label>
              <Input id="email" name="email" type="email" placeholder={t("placeholder")} required />
            </div>
            <Button type="submit" disabled={adding || pending}>
              {adding ? t("adding") : t("addButton")}
            </Button>
          </form>
        ) : null}

        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </CardContent>
    </Card>
  );
}
