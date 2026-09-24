import { z } from "zod";
import { SignatureType } from "@/generated/prisma/enums";

export const acceptQuoteSchema = z.object({
  name: z.string().trim().min(2, "portal.errors.nameRequired").max(120),
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v.toLowerCase()))
    .nullable()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "validation.invalidEmail"),
  signatureType: z.nativeEnum(SignatureType).default(SignatureType.NONE),
  signatureData: z
    .string()
    .trim()
    .max(200_000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  additionalComments: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  orderReference: z
    .string()
    .trim()
    .max(100)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export type AcceptQuoteValues = z.output<typeof acceptQuoteSchema>;

export const declineQuoteSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export const clientMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "portal.errors.messageEmpty")
    .max(4000, "portal.errors.messageTooLong"),
});

/**
 * The text of the statement the customer accepts.
 *
 * Assembled here and frozen on acceptance: if the company changes its wording the
 * following month, what's stored is still what that person read.
 */
export function buildStatement(
  template: string | null,
  name: string,
  fallback: string,
): string {
  const body = template?.trim() || fallback;
  return `${name} ${body}`.replace(/\s+/g, " ").trim();
}
