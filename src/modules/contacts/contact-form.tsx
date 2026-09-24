"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContactState } from "./actions";
import { useActionToast } from "@/lib/use-action-toast";

export type ContactDefaults = {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  clientCompanyName: string | null;
};

/** The person's own details. What came from them lives on their leads. */
export function ContactForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: ContactState, formData: FormData) => Promise<ContactState>;
  defaults?: ContactDefaults;
  submitLabel: string;
}) {
  const t = useTranslations("contacts.form");
  const [state, formAction, saving] = useActionState<ContactState, FormData>(action, {});

  useActionToast(state);

  const field = (name: keyof ContactDefaults, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={name}>{t(name)}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaults?.[name] ?? ""}
        required={name === "firstName"}
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
            {field("firstName")}
            {field("lastName")}
            {field("email", "email")}
            {field("phone")}
            {field("position")}
            {field("clientCompanyName")}
          </div>


          <Button type="submit" disabled={saving}>
            {saving ? t("saving") : submitLabel}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
