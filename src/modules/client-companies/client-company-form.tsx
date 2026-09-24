"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClientCompanyState } from "./actions";
import { useActionToast } from "@/lib/use-action-toast";

export type ClientCompanyDefaults = {
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
};

export function ClientCompanyForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: ClientCompanyState, formData: FormData) => Promise<ClientCompanyState>;
  defaults?: ClientCompanyDefaults;
  submitLabel: string;
}) {
  const t = useTranslations("clients.form");
  const [state, formAction, saving] = useActionState<ClientCompanyState, FormData>(action, {});

  useActionToast(state);

  const field = (name: keyof ClientCompanyDefaults, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={name}>{t(name)}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaults?.[name] ?? ""}
        required={name === "name"}
      />
      {state.fieldErrors?.[name] ? (
        <p className="text-sm text-destructive">{state.fieldErrors[name][0]}</p>
      ) : null}
    </div>
  );

  return (
    <form action={formAction}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("name")}
            {field("taxId")}
            {field("email", "email")}
            {field("phone")}
            {field("website")}
            {field("address")}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t("notes")}</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={defaults?.notes ?? ""} />
          </div>


          <Button type="submit" disabled={saving}>
            {saving ? t("saving") : submitLabel}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
