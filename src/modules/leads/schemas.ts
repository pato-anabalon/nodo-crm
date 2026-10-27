import { z } from "zod";
import { LeadSource, LeadStatus } from "@/generated/prisma/enums";

/** An empty form input arrives as "", not as undefined. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

const optionalEmail = optionalText.refine(
  (value) => !value || z.string().email().safeParse(value).success,
  { message: "validation.invalidEmail" },
);

export const leadFormSchema = z.object({
  title: z.string().trim().min(3, "leads.form.titleTooShort").max(200),
  description: optionalText,
  status: z.nativeEnum(LeadStatus).default(LeadStatus.NEW),
  source: z.nativeEnum(LeadSource).default(LeadSource.OTHER),
  // Checked against the company's own list in the service, not here: the
  // list lives in the database.
  sourceDetail: optionalText,
  score: z.coerce.number().int().min(0, "validation.min|min=0").max(100, "validation.max|max=100").default(0),
  // `z.coerce.number()` would turn "" into 0, so it's normalised first:
  // an empty field means "no estimated value", not "worth zero".
  estimatedValue: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
    z
      .number({ error: "validation.notANumber" })
      .min(0, "validation.notNegative")
      .nullable(),
  ),
  contactName: optionalText,
  contactEmail: optionalEmail,
  contactPhone: optionalText,
  companyName: optionalText,
  // Set only by picking an existing contact in the "existing contact"
  // combobox — never typed. The four fields above stay the lead's own
  // snapshot either way, which is what lets them diverge from the contact's
  // own record afterwards without that being a bug. `clientCompanyId` isn't
  // a field here at all: it's inherited server-side from whichever contact
  // this resolves to, in `resolveLeadLinks`.
  contactId: optionalText,
  ownerId: optionalText,
  lostReason: optionalText,
});

export type LeadFormInput = z.input<typeof leadFormSchema>;
export type LeadFormValues = z.output<typeof leadFormSchema>;

export const leadFiltersSchema = z.object({
  q: z.string().trim().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  ownerId: z.string().optional(),
  /** Shows the bin instead of the inbox. */
  discarded: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
});

export const discardLeadSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, "validation.maxChars|max=500")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export type LeadFilters = z.output<typeof leadFiltersSchema>;

/** Reads a lead's FormData without dragging in unrelated fields. */
export function leadFormDataToInput(formData: FormData): Record<string, unknown> {
  const get = (key: string) => {
    const value = formData.get(key);
    return value === null ? undefined : String(value);
  };

  return {
    title: get("title") ?? "",
    description: get("description"),
    status: get("status"),
    source: get("source"),
    sourceDetail: get("sourceDetail"),
    score: get("score") ?? 0,
    estimatedValue: get("estimatedValue"),
    contactName: get("contactName"),
    contactEmail: get("contactEmail"),
    contactPhone: get("contactPhone"),
    companyName: get("companyName"),
    contactId: get("contactId"),
    ownerId: get("ownerId"),
    lostReason: get("lostReason"),
  };
}

/**
 * A follow-up left in a lead's log: what, and the day and wall-clock time it is
 * for. Day and time stay separate strings here and become an instant in the
 * company's own timezone in the service — a server in another zone must not
 * decide that "11:00" means its own 11:00.
 */
export const scheduleActionSchema = z.object({
  title: z.string().trim().min(3, "validation.required").max(200),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validation.invalidDate"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "validation.invalidDate"),
  assigneeId: optionalText,
});

export type ScheduleActionValues = z.output<typeof scheduleActionSchema>;
