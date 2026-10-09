"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordFields } from "@/components/password-fields";
import { ROOT_DOMAIN } from "@/lib/tenant/host";
import { passwordsReady } from "@/lib/auth/password-policy";
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
  const tp = useTranslations("password");
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerCompany, {});

  useActionToast(state);
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

      <PasswordFields
        password={password}
        onPasswordChange={setPassword}
        confirmPassword={confirmPassword}
        onConfirmPasswordChange={setConfirmPassword}
        labels={{
          password: tp("choose"),
          confirmPassword: tp("confirm"),
          mismatch: tp("mismatch"),
          rules: {
            minLength: tp("rules.minLength"),
            uppercase: tp("rules.uppercase"),
            lowercase: tp("rules.lowercase"),
            number: tp("rules.number"),
          },
        }}
      />
      {state.fieldErrors?.password?.length ? (
        <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>
      ) : null}

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

      <Button type="submit" className="w-full" disabled={pending || !passwordsReady(password, confirmPassword)}>
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
