"use client";

import { Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordRuleResults, type PasswordRuleId } from "@/lib/auth/password-policy";

/**
 * The password + confirmation pair for wherever an account sets a *new*
 * password — register and the invitation's join screen, so far. One
 * component rather than two copies: the checklist is what stops a password
 * nobody can see being typed wrong with nothing to notice, and it needs to
 * read the exact same rules `acceptInvitationWithPassword`/`signupSchema`
 * enforce on the way in, not a second list that can drift from them.
 */
export function PasswordFields({
  password,
  onPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  labels,
}: {
  password: string;
  onPasswordChange: (value: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
  labels: {
    password: string;
    confirmPassword: string;
    mismatch: string;
    rules: Record<PasswordRuleId, string>;
  };
}) {
  const ruleResults = passwordRuleResults(password);
  const showMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="password">{labels.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">{labels.confirmPassword}</Label>
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
        />
        {showMismatch ? <p className="text-sm text-destructive">{labels.mismatch}</p> : null}
      </div>

      <ul className="space-y-1">
        {ruleResults.map((rule) => (
          <li
            key={rule.id}
            className={
              "flex items-center gap-1.5 text-sm " +
              (rule.met ? "text-green-600 dark:text-green-400" : "text-destructive")
            }
          >
            {rule.met ? (
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            {labels.rules[rule.id]}
          </li>
        ))}
      </ul>
    </>
  );
}
