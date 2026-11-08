/**
 * What counts as a strong enough password, for wherever somebody sets a new
 * one — today that's only `/join/<token>`, the one place in the app that
 * creates an account. Kept pure and separate from the schema that posts it
 * so the join screen's live checklist and the server's own check are
 * reading the exact same rules, not two lists that can drift apart.
 *
 * Deliberately not applied to verifying a password that already exists
 * (`acceptInvitationWithPassword`'s "already has one" branch, or signing
 * in): an account from before this policy existed must go on working with
 * whatever it was created with.
 */
export type PasswordRuleId = "minLength" | "uppercase" | "lowercase" | "number";

export const PASSWORD_RULES: { id: PasswordRuleId; test: (password: string) => boolean }[] = [
  { id: "minLength", test: (password) => password.length >= 8 },
  { id: "uppercase", test: (password) => /[A-Z]/.test(password) },
  { id: "lowercase", test: (password) => /[a-z]/.test(password) },
  { id: "number", test: (password) => /[0-9]/.test(password) },
];

export function passwordRuleResults(password: string): { id: PasswordRuleId; met: boolean }[] {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, met: rule.test(password) }));
}

export function meetsPasswordPolicy(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export function passwordsReady(password: string, confirmPassword: string): boolean {
  return meetsPasswordPolicy(password) && password === confirmPassword;
}
