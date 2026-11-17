"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { CompanyLogo } from "@/components/company-logo";
import { PasswordFields } from "@/components/password-fields";
import { syncLocaleAfterSignIn } from "@/i18n/actions";
import { passwordsReady } from "@/lib/auth/password-policy";
import type { JoinOutcome } from "./actions";

/**
 * Where a fresh invitee sets up their account, in one step rather than a
 * magic-link round trip: the token already proves they hold the invited
 * address, so typing a password here is what signs them up. Somebody invited
 * into a second company, who already has one from the first, is asked for it
 * instead (`hasPassword`) — the server checks it the same way a normal
 * sign-in would, and skips the strength checklist entirely: an account from
 * before the policy existed must go on signing in with what it already has.
 */
export function JoinPasswordForm({
  company,
  email,
  role,
  hasPassword,
  accept,
}: {
  company: { name: string; logoUrl: string | null };
  email: string;
  role: string;
  hasPassword: boolean;
  accept: (password: string) => Promise<JoinOutcome>;
}) {
  const router = useRouter();
  const t = useTranslations("team.join");
  const tp = useTranslations("password");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, startTransition] = useTransition();

  const canSubmit = hasPassword ? password.length > 0 : passwordsReady(password, confirmPassword);

  function onSubmit() {
    if (!canSubmit) return;
    setError(null);

    startTransition(async () => {
      const result = await accept(password);
      if (!result.ok) {
        if (result.reason === "wrong-password") setError(t("incorrectPassword"));
        else if (result.reason === "weak-password") setError(tp("weak"));
        else setError(t("invalid.not-found"));
        return;
      }

      // The password just succeeded server-side, so this only fails to sign
      // in if the two requests somehow disagreed.
      const signInResult = await signIn("credentials", { email, password, redirect: false });
      if (signInResult?.error) {
        setError(t("incorrectPassword"));
        return;
      }

      await syncLocaleAfterSignIn();
      // `refresh` forces the server to resolve the membership again now that
      // the session cookie exists — same reason the password login does it.
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Card>
        <CardContent className="space-y-4 pt-6 text-center">
          <div className="flex justify-center">
            <CompanyLogo name={company.name} logoUrl={company.logoUrl} size="lg" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold">{t("title", { company: company.name })}</h1>
            <p className="text-sm text-muted-foreground">{t("body", { role })}</p>
            <p className="text-sm text-muted-foreground">{t("forEmail", { email })}</p>
          </div>

          <form action={onSubmit} className="space-y-4 text-left">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {hasPassword ? (
              <div className="space-y-2">
                <Label htmlFor="password">{t("passwordLabel")}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            ) : (
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
            )}

            <Button type="submit" className="w-full" disabled={pending || !canSubmit}>
              {pending ? t("joining") : t("accept")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
