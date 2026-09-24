import { z } from "zod";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

/**
 * A due date is a date, not a moment.
 *
 * Stored at the end of that day in the company's own reckoning, so "due the
 * 10th" isn't overdue at one minute past midnight — which is what a bare date
 * parsed as UTC would give somebody in New Zealand.
 */
const dueDate = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(`${value.trim()}T23:59:59.999Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}, z.date({ error: "validation.invalidDate" }).nullable());

export const taskFormSchema = z.object({
  title: z.string().trim().min(3, "validation.required").max(200),
  notes: optional(2000),
  dueAt: dueDate,
  assigneeId: optional(40),
  leadId: optional(40),
  quoteId: optional(40),
  contactId: optional(40),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export type TaskFilters = { scope: "mine" | "all"; show: "open" | "done" };

export function taskFiltersFromParams(
  params: Record<string, string | string[] | undefined>,
): TaskFilters {
  const single = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  return {
    scope: single(params.scope) === "all" ? "all" : "mine",
    show: single(params.show) === "done" ? "done" : "open",
  };
}
