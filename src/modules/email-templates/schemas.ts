import { z } from "zod";
import { EmailTemplateKind, ReviewSource, SenderNameStyle } from "@/generated/prisma/enums";
import { unknownFields } from "./fields";

/**
 * Rejects a field the catalogue doesn't have.
 *
 * The message carries the offending names so the screen can list them: being
 * told "there is a mistake" and having to hunt for it is a bad way to spend an
 * afternoon, and the names are already known here.
 */
const withKnownFields = <T extends z.ZodType<string | null | undefined>>(schema: T) =>
  schema.superRefine((value, ctx) => {
    const unknown = unknownFields(value ?? "");
    if (unknown.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "emailTemplates.errors.unknownFields",
        params: { fields: unknown },
      });
    }
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const emailTemplateSchema = z.object({
  kind: z.nativeEnum(EmailTemplateKind),
  subject: withKnownFields(optionalText(200)),
  bodyHtml: withKnownFields(optionalText(20000)),
  enabled: z.coerce.boolean(),
});

export type EmailTemplateValues = z.infer<typeof emailTemplateSchema>;

/**
 * The parts shared by every email, which belong to the company rather than to
 * one template — the footer that closes them all, the slogan under the button,
 * and who the customer sees them from.
 */
export const emailSettingsSchema = z.object({
  quoteFooter: optionalText(4000),
  // Plain text on purpose: it sits directly under the one thing we want
  // clicked, and a bold or a link there only competes with it.
  slogan: optionalText(200),
  senderNameStyle: z.nativeEnum(SenderNameStyle),
  sendQuoteCopy: z.coerce.boolean(),

  // Both follow-ups count from the send, so the only rule between them is the
  // order they happen in. Saying "chase again on day 3" after a first chase on
  // day 7 is not a schedule, it is a mistake nobody would notice for a week.
  firstFollowUpDays: z.coerce.number().int().min(1).max(90),
  secondFollowUpDays: z.coerce.number().int().min(1).max(90),
  reviewRequestDays: z.coerce.number().int().min(1).max(90),
}).refine((values) => values.secondFollowUpDays > values.firstFollowUpDays, {
  path: ["secondFollowUpDays"],
  message: "emailTemplates.errors.secondBeforeFirst",
});

export type EmailSettingsValues = z.infer<typeof emailSettingsSchema>;

/** One place to be reviewed. Added one at a time, so each can be checked. */
export const reviewLinkSchema = z.object({
  source: z.nativeEnum(ReviewSource),
  url: z
    .string()
    .trim()
    .min(1, "settings.errors.invalidUrl")
    .refine((v) => /^https?:\/\//i.test(v), "settings.errors.invalidUrl")
    .refine((v) => {
      try {
        new URL(v);
        return true;
      } catch {
        return false;
      }
    }, "settings.errors.invalidUrl"),
});

export type ReviewLinkValues = z.infer<typeof reviewLinkSchema>;
