"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { syncLocaleAfterSignIn } from "@/i18n/actions";

export function LoginForm() {
  const router = useRouter();
  const t = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false,
      });

      if (result?.error) {
        // Deliberately generic message: we don't reveal whether the email exists.
        setError(t("invalidCredentials"));
        return;
      }

      // The user's saved language wins over the browser's.
      await syncLocaleAfterSignIn();

      // `refresh` forces the server to resolve the membership again now that
      // the session cookie exists.
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form action={onSubmit} className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("signingIn") : t("signIn")}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">{t("or")}</span>
        <Separator className="flex-1" />
      </div>

      <form
        action={(formData: FormData) => {
          startTransition(async () => {
            await signIn("resend", { email: String(formData.get("email") ?? ""), redirect: false });
            setError(null);
          });
        }}
        className="space-y-2"
      >
        <Label htmlFor="magic-email">{t("magicLinkLabel")}</Label>
        <div className="flex gap-2">
          <Input id="magic-email" name="email" type="email" required placeholder="you@company.co.nz" />
          <Button type="submit" variant="outline" disabled={pending}>
            {t("send")}
          </Button>
        </div>
      </form>
    </div>
  );
}
