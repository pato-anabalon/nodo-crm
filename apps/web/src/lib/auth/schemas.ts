import { z } from "zod";
import { meetsPasswordPolicy } from "./password-policy";

// The messages are keys from `messages/*.json`; the server action that receives
// the form translates them (see src/lib/i18n-errors.ts).
//
// Only `min(8)` here, not the full `meetsPasswordPolicy` — this schema also
// verifies a password that's already on file, and an account from before
// the policy existed must go on signing in with whatever it already has.
export const credentialsSchema = z.object({
  email: z.string().email("validation.invalidEmail"),
  password: z.string().min(8, "validation.passwordTooShort"),
});

export const signupSchema = z
  .object({
    name: z.string().min(2, "validation.enterYourName"),
    email: z.string().email("validation.invalidEmail"),
    // This one sets a brand new password, so the full policy applies —
    // the same rules the join screen's checklist shows live.
    password: z.string().refine(meetsPasswordPolicy, "validation.passwordTooWeak"),
    companyName: z.string().min(2, "validation.enterCompanyName"),
    companySlug: z
      .string()
      .min(3, "validation.slugTooShort")
      .max(50, "validation.slugTooLong")
      .regex(/^[a-z0-9-]+$/, "validation.slugFormat"),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;
