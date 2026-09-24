"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROOT_DOMAIN } from "@/lib/tenant/host";
import { registerCompany, type RegisterState } from "./actions";
import { useActionToast } from "@/lib/use-action-toast";

/** Turns "Acme Ltd." into "acme-ltd", which is what the subdomain uses. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function RegisterForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerCompany, {});

  useActionToast(state);
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  // Until the user edits the subdomain, it's derived from the name.
  const effectiveSlug = slugTouched ? slug : slugify(companyName);

  useEffect(() => {
    // Sign-up ends on another subdomain, so `redirect()` won't do.
    if (state.redirectTo) window.location.href = state.redirectTo;
  }, [state.redirectTo]);

  return (
    <form action={action} className="space-y-4">

      <Field label={t("yourName")} name="name" errors={state.fieldErrors?.name}>
        <Input id="name" name="name" required autoComplete="name" placeholder="Jane Doe" />
      </Field>

      <Field label={t("email")} name="email" errors={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@company.co.nz" />
      </Field>

      <Field label={t("password")} name="password" errors={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>

      <Field label={t("companyName")} name="companyName" errors={state.fieldErrors?.companyName}>
        <Input
          id="companyName"
          name="companyName"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Acme Ltd"
        />
      </Field>

      <Field label={t("crmAddress")} name="companySlug" errors={state.fieldErrors?.companySlug}>
        <div className="flex items-center rounded-md border border-input focus-within:ring-[3px] focus-within:ring-ring/50">
          <Input
            id="companySlug"
            name="companySlug"
            required
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            className="border-0 shadow-none focus-visible:ring-0"
            placeholder="acme"
          />
          <span className="shrink-0 pr-3 text-sm text-muted-foreground">.{ROOT_DOMAIN}</span>
        </div>
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("creating") : t("createCompany")}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  errors,
  children,
}: {
  label: string;
  name: string;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {errors?.length ? <p className="text-sm text-destructive">{errors[0]}</p> : null}
    </div>
  );
}
