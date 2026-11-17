import { z } from "zod";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const clientCompanyFormSchema = z.object({
  name: z.string().trim().min(1, "validation.required").max(160),
  taxId: optional(40),
  email: optional(160).refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "validation.invalidEmail",
  ),
  phone: optional(60),
  website: optional(200),
  address: optional(300),
  notes: optional(2000),
});

export type ClientCompanyFormValues = z.infer<typeof clientCompanyFormSchema>;

export type ClientCompanyFilters = { q?: string; page: number };

export function clientCompanyFiltersFromParams(
  params: Record<string, string | string[] | undefined>,
): ClientCompanyFilters {
  const single = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(single(params.page) ?? "1", 10);

  return {
    q: single(params.q)?.trim() || undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}
