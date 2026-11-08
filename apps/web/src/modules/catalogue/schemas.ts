import { z } from "zod";

/**
 * A price typed by a person, not by a machine.
 *
 * Empty means nothing rather than zero, and a comma is accepted as the decimal
 * separator: in New Zealand and in Chile alike, people type what their keyboard
 * and their habits give them.
 */
const price = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const cleaned = value.trim().replace(/\s/g, "").replace(",", ".");
    return cleaned === "" ? undefined : Number(cleaned);
  },
  z.number({ error: "validation.invalidNumber" }).min(0).max(99_999_999),
);

export const catalogueItemSchema = z.object({
  name: z.string().trim().min(1, "validation.required").max(160),
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  unit: z
    .string()
    .trim()
    .max(20)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  unitPrice: price,
});

export type CatalogueItemValues = z.infer<typeof catalogueItemSchema>;

export type CatalogueFilters = { q?: string; includeRetired: boolean };

export function catalogueFiltersFromParams(
  params: Record<string, string | string[] | undefined>,
): CatalogueFilters {
  const single = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  return {
    q: single(params.q)?.trim() || undefined,
    includeRetired: single(params.retired) === "1",
  };
}
