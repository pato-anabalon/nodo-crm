import { z } from "zod";

/** Who is being invited, and as what. */
export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "validation.required")
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "validation.invalidEmail"),
  roleId: z.string().trim().min(1, "validation.required"),
});

export type InviteValues = z.infer<typeof inviteSchema>;

export const ROLE_NAME_MAX = 60;

/**
 * What a company calls a profile. Empty is a real answer — "use the standard
 * name" — so it becomes `null` rather than an error, and the translated name
 * takes over again.
 */
export const roleNameSchema = z.object({
  name: z
    .string()
    .trim()
    .max(ROLE_NAME_MAX, `validation.maxChars|max=${ROLE_NAME_MAX}`)
    .transform((value) => (value === "" ? null : value)),
});

/** A new profile: what it is called, and which profile it starts as a copy of. */
export const createRoleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "validation.required")
    .max(ROLE_NAME_MAX, `validation.maxChars|max=${ROLE_NAME_MAX}`),
  // Empty means "start with nothing ticked".
  copyFrom: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value)),
});
