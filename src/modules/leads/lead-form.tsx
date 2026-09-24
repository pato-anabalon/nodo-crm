"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LEAD_PIPELINE, LEAD_SOURCES } from "./constants";
import type { LeadActionState } from "./actions";
import { LeadSource, LeadStatus } from "@/generated/prisma/enums";
import { useActionToast } from "@/lib/use-action-toast";

export type LeadFormDefaults = {
  title?: string;
  description?: string | null;
  status?: LeadStatus;
  source?: LeadSource;
  score?: number;
  estimatedValue?: number | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  companyName?: string | null;
  ownerId?: string | null;
  lostReason?: string | null;
};

export function LeadForm({
  action,
  defaults = {},
  members,
  canAssign,
  submitLabel,
  currency,
}: {
  action: (prev: LeadActionState, formData: FormData) => Promise<LeadActionState>;
  defaults?: LeadFormDefaults;
  members: Array<{ userId: string; name: string }>;
  canAssign: boolean;
  submitLabel: string;
  currency: string;
}) {
  const [state, formAction, pending] = useActionState<LeadActionState, FormData>(action, {});

  useActionToast(state);
  const t = useTranslations("leads");
  const tCommon = useTranslations("common");
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-3">

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{t("form.opportunity")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={t("form.title")} name="title" error={errors.title?.[0]}>
            <Input
              id="title"
              name="title"
              required
              defaultValue={defaults.title}
              placeholder={t("form.titlePlaceholder")}
            />
          </Field>

          <Field label={t("form.description")} name="description" error={errors.description?.[0]}>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={defaults.description ?? ""}
              placeholder={t("form.descriptionPlaceholder")}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.status")} name="status" error={errors.status?.[0]}>
              <NativeSelect id="status" name="status" defaultValue={defaults.status ?? LeadStatus.NEW}>
                {LEAD_PIPELINE.map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field label={t("form.source")} name="source" error={errors.source?.[0]}>
              <NativeSelect id="source" name="source" defaultValue={defaults.source ?? LeadSource.OTHER}>
                {LEAD_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {t(`source.${source}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <Field
            label={t("form.lostReason")}
            name="lostReason"
            hint={t("form.lostReasonHint")}
            error={errors.lostReason?.[0]}
          >
            <Input id="lostReason" name="lostReason" defaultValue={defaults.lostReason ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("form.contact")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={t("form.contactName")} name="contactName" error={errors.contactName?.[0]}>
              <Input id="contactName" name="contactName" defaultValue={defaults.contactName ?? ""} />
            </Field>
            <Field label={t("form.companyName")} name="companyName" error={errors.companyName?.[0]}>
              <Input id="companyName" name="companyName" defaultValue={defaults.companyName ?? ""} />
            </Field>
            <Field label={t("form.contactEmail")} name="contactEmail" error={errors.contactEmail?.[0]}>
              <Input id="contactEmail" name="contactEmail" type="email" defaultValue={defaults.contactEmail ?? ""} />
            </Field>
            <Field label={t("form.contactPhone")} name="contactPhone" error={errors.contactPhone?.[0]}>
              <Input id="contactPhone" name="contactPhone" defaultValue={defaults.contactPhone ?? ""} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("form.tracking")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={t("form.estimatedValue", { currency })} name="estimatedValue" error={errors.estimatedValue?.[0]}>
              <Input
                id="estimatedValue"
                name="estimatedValue"
                type="number"
                min={0}
                step="1"
                defaultValue={defaults.estimatedValue ?? ""}
              />
            </Field>

            <Field label={t("form.score")} name="score" error={errors.score?.[0]}>
              <Input id="score" name="score" type="number" min={0} max={100} defaultValue={defaults.score ?? 0} />
            </Field>

            {canAssign ? (
              <Field label={t("form.owner")} name="ownerId" error={errors.ownerId?.[0]}>
                <NativeSelect id="ownerId" name="ownerId" defaultValue={defaults.ownerId ?? ""}>
                  <option value="">{tCommon("unassigned")}</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? tCommon("saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
