import { z } from "zod";
import { PricingMode, QuoteStatus, TaxDisplayMode } from "@/generated/prisma/enums";
import { isSupportedCurrency } from "@/lib/intl/options";
import { QUOTE_SECTIONS } from "./constants";

export const quoteItemSchema = z.object({
  description: z.string().trim().min(1, "quotes.form.describeItem").max(300),
  quantity: z.coerce.number().positive("quotes.form.quantityPositive").max(1_000_000),
  unitPrice: z.coerce.number().min(0, "quotes.form.priceNotNegative").max(1_000_000_000),
  discount: z.coerce.number().min(0).max(100, "quotes.form.discountRange").default(0),
});

export const quoteSectionSchema = z.object({
  title: z.string().trim().min(2, "quotes.form.sectionTitleRequired").max(200),
  body: z
    .string()
    .trim()
    .max(8000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  amount: z.coerce.number().min(0, "validation.notNegative").max(1_000_000_000),
});

export const quoteFormSchema = z
  .object({
  title: z.string().trim().min(3, "quotes.form.titleTooShort").max(200),
  pricingMode: z.nativeEnum(PricingMode).default(PricingMode.ITEMIZED),
  sections: z.array(quoteSectionSchema),
  leadId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  taxRate: z.coerce.number().min(0).max(100).default(15),
  // Optional, same reason as currency below: the service fills in the
  // company's own setting when the form doesn't send one (a new quote, before
  // the person has touched the select).
  taxDisplayMode: z.nativeEnum(TaxDisplayMode).optional(),
  // Optional, and left to the service to fill in from the company. A default
  // here would be a second opinion about what the company's currency is, in a
  // file that has no way of knowing.
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isSupportedCurrency, "settings.errors.unknownCurrency")
    .optional(),
  discount: z.coerce.number().min(0).default(0),
  intro: z
    .string()
    .trim()
    .max(8000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  exclusions: z
    .string()
    .trim()
    .max(8000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  termsDocumentId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  validUntil: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  notes: z
    .string()
    .trim()
    .max(4000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  terms: z
    .string()
    .trim()
    .max(4000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  items: z.array(quoteItemSchema),
  })
  // Each mode demands its own: at least one line, or at least one section.
  .superRefine((data, ctx) => {
    if (data.pricingMode === PricingMode.ITEMIZED) {
      if (data.items.length === 0) {
        ctx.addIssue({ code: "custom", path: ["items"], message: "quotes.form.atLeastOneLine" });
      }
      return;
    }

    if (data.sections.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["sections"],
        message: "quotes.form.atLeastOneSection",
      });
    }
  });

export type QuoteFormValues = z.output<typeof quoteFormSchema>;

export const quoteFiltersSchema = z.object({
  q: z.string().trim().optional(),
  status: z.nativeEnum(QuoteStatus).optional(),
  section: z.enum(QUOTE_SECTIONS).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});

export type QuoteFilters = z.output<typeof quoteFiltersSchema>;

/**
 * Lines travel in the FormData as `items[0].description`, and so on.
 * They're regrouped by index, keeping the order they came in.
 */
/**
 * Reads a repeated group from the FormData: `items[0].description`,
 * `sections[1].title`. Regrouped by index, keeping the order it came in.
 */
function parseGroup(formData: FormData, group: string, requiredField: string): unknown[] {
  const byIndex = new Map<number, Record<string, string>>();
  const pattern = new RegExp(`^${group}\\[(\\d+)\\]\\.(\\w+)$`);

  for (const [key, value] of formData.entries()) {
    const match = pattern.exec(key);
    if (!match) continue;

    const index = Number(match[1]);
    const row = byIndex.get(index) ?? {};
    row[match[2]] = String(value);
    byIndex.set(index, row);
  }

  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row)
    // A blank row left over from the form shouldn't break the save.
    .filter((row) => (row[requiredField] ?? "").trim() !== "");
}

export function parseQuoteSections(formData: FormData): unknown[] {
  return parseGroup(formData, "sections", "title");
}

export function parseQuoteItems(formData: FormData): unknown[] {
  const byIndex = new Map<number, Record<string, string>>();

  for (const [key, value] of formData.entries()) {
    const match = /^items\[(\d+)\]\.(\w+)$/.exec(key);
    if (!match) continue;

    const index = Number(match[1]);
    const field = match[2];
    const row = byIndex.get(index) ?? {};
    row[field] = String(value);
    byIndex.set(index, row);
  }

  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row)
    // A blank row left over from the form shouldn't break the save.
    .filter((row) => (row.description ?? "").trim() !== "");
}

export function quoteFormDataToInput(formData: FormData): Record<string, unknown> {
  const get = (key: string) => {
    const value = formData.get(key);
    return value === null ? undefined : String(value);
  };

  return {
    intro: get("intro"),
    exclusions: get("exclusions"),
    title: get("title") ?? "",
    pricingMode: get("pricingMode") ?? PricingMode.ITEMIZED,
    sections: parseQuoteSections(formData),
    leadId: get("leadId"),
    termsDocumentId: get("termsDocumentId"),
    taxRate: get("taxRate") ?? 15,
    taxDisplayMode: get("taxDisplayMode"),
    currency: get("currency"),
    discount: get("discount") ?? 0,
    validUntil: get("validUntil"),
    notes: get("notes"),
    terms: get("terms"),
    items: parseQuoteItems(formData),
  };
}
