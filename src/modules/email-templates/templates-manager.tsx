"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/rich-text-editor";
import { EmailTemplateKind } from "@/generated/prisma/enums";
import { EMAIL_FIELDS } from "./fields";
import { saveEmailTemplateAction, type EmailTemplateState } from "./actions";
import { useEffect } from "react";

export type TemplateCard = {
  kind: EmailTemplateKind;
  subject: string | null;
  bodyHtml: string | null;
  enabled: boolean;
  optional: boolean;
  /** Whether anything actually sends this yet. */
  live: boolean;
  /** The platform's own wording, shown as help — never as content. */
  defaultSubject: string;
  defaultBody: string;
};

export function EmailTemplateForm({ card }: { card: TemplateCard }) {
  const t = useTranslations("emailTemplates");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<EmailTemplateState, FormData>(
    saveEmailTemplateAction,
    {},
  );

  useEffect(() => {
    if (state.message) toast.success(state.message);
    if (state.error) toast.error(state.error);
  }, [state]);

  const errors = state.fieldErrors ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t(`kinds.${card.kind}.name`)}</CardTitle>
        <p className="text-xs text-muted-foreground">{t(`kinds.${card.kind}.when`)}</p>
        {!card.live ? (
          <p className="text-xs text-muted-foreground">{t("notLiveYet")}</p>
        ) : null}
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="kind" value={card.kind} />

          <div className="space-y-2">
            <Label htmlFor={`subject-${card.kind}`}>{t("subject")}</Label>
            <Input
              id={`subject-${card.kind}`}
              name="subject"
              defaultValue={card.subject ?? ""}
              placeholder={card.defaultSubject}
            />
            <p className="text-xs text-muted-foreground">{t("subjectHint")}</p>
            {errors.subject?.map((message) => (
              <p key={message} className="text-xs text-destructive">{message}</p>
            ))}
          </div>

          <div className="space-y-2">
            <Label>{t("body")}</Label>
            <RichTextEditor
              name="bodyHtml"
              defaultValue={card.bodyHtml}
              placeholder={card.defaultBody}
              ariaLabel={t("body")}
            />
            {/*
              The default is shown as the editor's placeholder, not loaded into
              it. Prefilling would turn the platform's wording into this
              company's own text the moment they saved, and from then on they
              would sit out every improvement to it — in one language, since a
              typed text is not translated.
            */}
            <p className="text-xs text-muted-foreground">{t("bodyHint")}</p>
            {errors.bodyHtml?.map((message) => (
              <p key={message} className="text-xs text-destructive">{message}</p>
            ))}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">{t("fieldsTitle")}</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {EMAIL_FIELDS.map((field) => (
                <li key={field} className="text-xs text-muted-foreground">
                  {/* Built here, never in the message files: `{{` is a malformed
                      argument to the ICU parser next-intl runs every string through. */}
                  <code className="rounded bg-muted px-1 py-0.5">{`{{${field}}}`}</code>{" "}
                  {t(`fields.${field}`)}
                </li>
              ))}
            </ul>
          </div>

          {card.optional ? (
            <label className="flex items-start gap-2">
              <Checkbox name="enabled" defaultChecked={card.enabled} />
              <span className="text-sm">{t("enabled")}</span>
            </label>
          ) : (
            <input type="hidden" name="enabled" value="true" />
          )}

          <Button type="submit" disabled={pending}>
            {pending ? tCommon("saving") : tCommon("saveChanges")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
