import { z } from "zod";
import { isRichTextEmpty, sanitizeRichText } from "@/lib/rich-text";
import { daySchema } from "../schemas";

/** Optional rich text in the Message Board's profile; blank reads as none. */
const notes = z
  .string()
  .max(200_000)
  .transform((html) => sanitizeRichText(html, "full"))
  .transform((html) => (isRichTextEmpty(html) ? null : html));

export const todoListSchema = z.object({
  name: z.string().trim().min(1, "validation.required").max(200),
  description: notes,
});

export type TodoListValues = z.infer<typeof todoListSchema>;

export const todoSchema = z
  .object({
    title: z.string().trim().min(1, "validation.required").max(500),
    notes,
    startsOn: daySchema,
    dueOn: daySchema,
  })
  .refine((v) => !v.startsOn || !v.dueOn || v.dueOn >= v.startsOn, {
    path: ["dueOn"],
    message: "jobs.validation.endBeforeStart",
  });

export type TodoValues = z.infer<typeof todoSchema>;

/** The ids a reorder posts, in their new order. Shape only — whose they are is the service's question. */
export const orderSchema = z.array(z.string().min(1).max(64)).min(1).max(1000);
