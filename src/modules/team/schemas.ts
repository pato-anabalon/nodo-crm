import { z } from "zod";
import { RoleKey } from "@/generated/prisma/enums";

/** Who is being invited, and as what. */
export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "validation.required")
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "validation.invalidEmail"),
  roleKey: z.nativeEnum(RoleKey),
});

export type InviteValues = z.infer<typeof inviteSchema>;
