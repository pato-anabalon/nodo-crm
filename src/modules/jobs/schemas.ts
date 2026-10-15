import { z } from "zod";
import { JobStatus } from "@/generated/prisma/enums";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

/**
 * A job's start and end are days, not moments: stored as a `@db.Date`, so
 * midnight UTC on the day typed carries no timezone to drift by.
 */
export const daySchema = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return undefined;
  const parsed = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}, z.date({ error: "validation.invalidDate" }).nullable());

export const jobFormSchema = z.object({
  name: z.string().trim().min(2, "validation.required").max(200),
  description: optional(2000),
  address: optional(300),
});

export type JobFormValues = z.infer<typeof jobFormSchema>;

export const jobDatesSchema = z
  .object({ startsOn: daySchema, endsOn: daySchema })
  .refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, {
    path: ["endsOn"],
    message: "jobs.validation.endBeforeStart",
  });

export type JobDates = z.infer<typeof jobDatesSchema>;

export const jobStatusSchema = z.nativeEnum(JobStatus);

export const tradeNameSchema = z.string().trim().min(1, "validation.required").max(60);

/** `YYYY-MM-DD` of a stored day, or null — the shape `JobActivity` params use. */
export function dayKey(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export type JobListFilter = "active" | "done";

export function jobListFilterFromParams(params: Record<string, string | string[] | undefined>): JobListFilter {
  return params.show === "done" ? "done" : "active";
}
