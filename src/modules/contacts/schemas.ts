import { z } from "zod";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const contactFormSchema = z.object({
  firstName: z.string().trim().min(1, "validation.required").max(80),
  lastName: optional(80),
  email: optional(160).refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "validation.invalidEmail",
  ),
  phone: optional(60),
  position: optional(80),
  clientCompanyName: optional(160),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export type ContactFilters = { q?: string; page: number };

export function contactFiltersFromParams(
  params: Record<string, string | string[] | undefined>,
): ContactFilters {
  const single = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(single(params.page) ?? "1", 10);

  return {
    q: single(params.q)?.trim() || undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}
