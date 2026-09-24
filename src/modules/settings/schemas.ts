import { z } from "zod";
import { AcceptanceMode, Language, TaxType } from "@/generated/prisma/enums";
import {
  isSupportedCurrency,
  isSupportedFormatLocale,
  isSupportedTimezone,
} from "@/lib/intl/options";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

/** Details the customer sees in the header of every quote. */
export const companyProfileSchema = z.object({
  name: z.string().trim().min(2, "settings.errors.nameRequired").max(120),
  legalName: optionalText(200),
  taxId: optionalText(40),
  email: optionalText(160).refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "validation.invalidEmail",
  ),
  phone: optionalText(160),
  website: optionalText(200),
  address: optionalText(300),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/, "settings.errors.invalidColor"),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/, "settings.errors.invalidColor"),
});

/** How quoting works: currency, tax and the copy that goes with every quote. */
export const quoteSettingsSchema = z.object({
  // Checked against the very list the select offered, not merely for shape:
  // `XYZ` is three letters and `Pacific/Aukland` is a plausible string, and
  // both fail silently later — the amount stops formatting, the dates shift a
  // day. The field is only reachable through a select, so anything else
  // arriving here was hand-crafted.
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isSupportedCurrency, "settings.errors.unknownCurrency"),
  formatLocale: z
    .string()
    .trim()
    .refine(isSupportedFormatLocale, "settings.errors.unknownFormatLocale"),
  timezone: z.string().trim().refine(isSupportedTimezone, "settings.errors.unknownTimezone"),
  defaultLanguage: z.nativeEnum(Language),
  defaultTaxType: z.nativeEnum(TaxType),
  defaultTaxRate: z.coerce.number().min(0).max(100),
  pricesIncludeTax: z.coerce.boolean(),
  quotePrefix: z.string().trim().min(1).max(10).toUpperCase(),
  quoteValidityDays: z.coerce.number().int().min(1).max(365),
  quoteIntro: optionalText(8000),
  quoteNotes: optionalText(8000),
  quoteExclusions: optionalText(8000),
  quoteTerms: optionalText(8000),
});

/** What the customer is asked for in order to accept. */
export const acceptanceSettingsSchema = z.object({
  acceptanceMode: z.nativeEnum(AcceptanceMode),
  acceptanceStatement: optionalText(2000),
  requireSignature: z.coerce.boolean(),
  askAdditionalComments: z.coerce.boolean(),
  askOrderReference: z.coerce.boolean(),
});

export const reviewSchema = z.object({
  author: z.string().trim().min(2, "settings.errors.authorRequired").max(120),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(10, "settings.errors.reviewTooShort").max(2000),
  source: z.enum(["GOOGLE", "NOCOWBOYS", "FACEBOOK", "OTHER"]),
  sourceUrl: optionalText(500).refine(
    (v) => !v || /^https?:\/\//.test(v),
    "settings.errors.invalidUrl",
  ),
  featured: z.coerce.boolean(),
});

/** An unticked checkbox isn't sent in the FormData: absent means false. */
export function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}
