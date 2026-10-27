import { z } from "zod";
import {
  AcceptanceMode,
  Language,
  ReviewSource,
  TaxDisplayMode,
  TaxType,
} from "@/generated/prisma/enums";
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
  taxDisplayMode: z.nativeEnum(TaxDisplayMode),
  quotePrefix: z.string().trim().min(1).max(10).toUpperCase(),
  quoteValidityDays: z.coerce.number().int().min(1).max(365),
  quoteIntro: optionalText(8000),
  quoteNotes: optionalText(8000),
  quoteExclusions: optionalText(8000),
  quoteTerms: optionalText(8000),
  quoteScope: optionalText(8000),
});

/**
 * One entry in the company's own list of document kinds ("Estimate For",
 * "Quote For", "Variation For", or whatever it wants to call what it sends).
 * Added one at a time, same as a `ReviewLink` — each label is checked on the
 * way in, and `@@unique([companyId, label])` on the row itself catches a
 * duplicate the schema alone can't.
 */
export const quoteTypeSchema = z.object({
  label: z.string().trim().min(1, "quotes.form.quoteTypeLabelRequired").max(100),
});

/** An option offered under a lead's source "Other". Same shape and reason as
 * `quoteTypeSchema`: one at a time, checked on the way in. */
export const leadSourceOptionSchema = z.object({
  label: z.string().trim().min(1, "settings.leadSources.labelRequired").max(100),
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

const optionalUrl = optionalText(1000).refine((v) => {
  if (!v) return true;
  if (!/^https?:\/\//i.test(v)) return false;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}, "settings.errors.invalidUrl");

/**
 * One platform the company is reviewed on, with its two addresses.
 *
 * Either link may be left out — a platform can be somewhere to read reviews
 * without being somewhere to ask for one — but not both, or the row says
 * nothing. "Somewhere else" has to be named: it is what the customer reads.
 */
export const reviewPlatformSchema = z
  .object({
    source: z.nativeEnum(ReviewSource),
    label: optionalText(60),
    readUrl: optionalUrl,
    leaveUrl: optionalUrl,
  })
  .superRefine((values, issue) => {
    if (values.source === ReviewSource.OTHER && !values.label) {
      issue.addIssue({ code: "custom", path: ["label"], message: "settings.errors.platformNameRequired" });
    }
    if (!values.readUrl && !values.leaveUrl) {
      issue.addIssue({ code: "custom", path: ["readUrl"], message: "settings.errors.oneLinkRequired" });
    }
  })
  // A known platform is named by its source; a label posted alongside one is
  // a leftover from switching the select, not a name.
  .transform((values) => ({
    ...values,
    label: values.source === ReviewSource.OTHER ? (values.label ?? null) : null,
    readUrl: values.readUrl ?? null,
    leaveUrl: values.leaveUrl ?? null,
  }));

export type ReviewPlatformValues = z.infer<typeof reviewPlatformSchema>;

/** An unticked checkbox isn't sent in the FormData: absent means false. */
export function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}
