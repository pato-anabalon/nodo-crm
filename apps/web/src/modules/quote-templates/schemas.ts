import { z } from "zod";

/**
 * Naming is the whole point.
 *
 * A template is a *kind* of job — "Rockcote full replaster" — and the name is
 * what makes it findable six months later. Letting it default to the quote's own
 * title is how a template list turns into a list of old addresses.
 */
export const templateNameSchema = z.object({
  name: z.string().trim().min(3, "validation.required").max(120),
  description: z
    .string()
    .trim()
    .max(400)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export type TemplateNameValues = z.infer<typeof templateNameSchema>;
