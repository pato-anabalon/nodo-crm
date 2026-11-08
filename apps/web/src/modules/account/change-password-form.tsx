"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordFields } from "@/components/password-fields";
import { useActionToast } from "@/lib/use-action-toast";
import { passwordsReady } from "@/lib/auth/password-policy";
import { changePasswordAction, type AccountState } from "./actions";

/**
 * `hasPassword` decides whether a current-password field even shows: someone
 * who has only ever signed in by magic link has nothing yet to confirm
 * against, the same distinction the join screen already makes.
 */
export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("account.changePassword");
  const tp = useTranslations("password");
  const [state, action, pending] = useActionState<AccountState, FormData>(changePasswordAction, {});
  useActionToast(state);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Cleared once the fields they came from have done their job, rather than
  // from an effect reacting to it afterwards — adjusting state during the
  // render that already has the new `state` is the one React considers safe.
  const [clearedFor, setClearedFor] = useState(state);
  if (state !== clearedFor && state.message) {
    setClearedFor(state);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  } else if (state !== clearedFor) {
    setClearedFor(state);
  }

  const canSubmit = (!hasPassword || currentPassword.length > 0) && passwordsReady(newPassword, confirmPassword);

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {hasPassword ? (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t("currentLabel")}</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              {state.fieldErrors?.currentPassword?.length ? (
                <p className="text-sm text-destructive">{state.fieldErrors.currentPassword[0]}</p>
              ) : null}
            </div>
          ) : null}

          <PasswordFields
            password={newPassword}
            onPasswordChange={setNewPassword}
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
          {state.fieldErrors?.newPassword?.length ? (
            <p className="text-sm text-destructive">{state.fieldErrors.newPassword[0]}</p>
          ) : null}

          <Button type="submit" disabled={pending || !canSubmit}>
            {pending ? t("saving") : t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
