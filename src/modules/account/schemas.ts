import { z } from "zod";

// Empty is a choice, not a mistake: somebody who clears the field wants the
// line gone from the quote, so it is stored as null rather than as "".
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `validation.maxChars|max=${max}`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const profileSchema = z.object({
  name: z.string().trim().min(2, "validation.enterYourName"),
  // Under the issuer's name on the quote the customer opens, and on its PDF.
  jobTitle: optional(80),
  // Stored, not yet shown anywhere: the quote's "Phone" line is the company's.
  phone: optional(60),
});
