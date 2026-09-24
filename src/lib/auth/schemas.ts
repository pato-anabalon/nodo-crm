import { z } from "zod";

// The messages are keys from `messages/*.json`; the server action that receives
// the form translates them (see src/lib/i18n-errors.ts).
export const credentialsSchema = z.object({
  email: z.string().email("validation.invalidEmail"),
  password: z.string().min(8, "validation.passwordTooShort"),
});

export const signupSchema = z
  .object({
    name: z.string().min(2, "validation.enterYourName"),
    email: z.string().email("validation.invalidEmail"),
    password: z.string().min(8, "validation.passwordTooShort"),
    companyName: z.string().min(2, "validation.enterCompanyName"),
    companySlug: z
      .string()
      .min(3, "validation.slugTooShort")
      .max(50, "validation.slugTooLong")
      .regex(/^[a-z0-9-]+$/, "validation.slugFormat"),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;
