"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ReviewSource } from "@/generated/prisma/enums";
import { useActionToast } from "@/lib/use-action-toast";
import {
  addReviewLinkAction,
  removeReviewLinkAction,
  type EmailTemplateState,
} from "./actions";

export type ReviewLinkRow = { id: string; source: ReviewSource; url: string };

/**
 * Where the company sends a happy customer to leave a review.
 *
 * Added one at a time so each address can be checked as it arrives, and removed
 * one at a time so fixing one doesn't mean retyping the rest.
 */
export function ReviewLinks({
  links,
  canManage,
}: {
  links: ReviewLinkRow[];
  canManage: boolean;
}) {
  const t = useTranslations("emailTemplates.reviewLinks");
  const [state, formAction, adding] = useActionState<EmailTemplateState, FormData>(
    addReviewLinkAction,
    {},
  );
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useActionToast(state);

  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state]);

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeReviewLinkAction(id);
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  const taken = new Set(links.map((link) => link.source));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {links.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t(`sources.${link.source}`)}</p>
                  <p className="truncate text-xs text-muted-foreground">{link.url}</p>
                </div>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => remove(link.id)}
                    aria-label={t("remove", { source: t(`sources.${link.source}`) })}
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
            <div className="space-y-2">
              <Label htmlFor="source">{t("platform")}</Label>
              <NativeSelect
                id="source"
                name="source"
                className="w-auto"
                options={Object.values(ReviewSource).map((source) => ({
                  value: source,
                  // A platform already listed stays selectable: choosing it
                  // again is how somebody fixes a link they got wrong.
                  label: taken.has(source) ? `${t(`sources.${source}`)} ·` : t(`sources.${source}`),
                }))}
              />
            </div>

            <div className="min-w-60 flex-1 space-y-2">
              <Label htmlFor="url">{t("url")}</Label>
              <Input id="url" name="url" placeholder="https://" />
              {state.fieldErrors?.url?.map((message) => (
                <p key={message} className="text-xs text-destructive">{message}</p>
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
