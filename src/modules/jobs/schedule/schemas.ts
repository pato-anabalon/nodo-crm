import { z } from "zod";
import { isRichTextEmpty, sanitizeRichText } from "@/lib/rich-text";
import { isDay } from "./calendar";

const notes = z
  .string()
  .max(200_000)
  .transform((html) => sanitizeRichText(html, "full"))
  .transform((html) => (isRichTextEmpty(html) ? null : html));

const day = z.string().trim().refine(isDay, "validation.invalidDate");
const time = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "jobs.schedule.validation.time");

/**
 * An event as the form sends it: the days in the company's own calendar, and
 * the times on its own clocks. Turning those into instants is the service's
 * job, which knows the company's timezone; this only checks they make sense.
 * A blank end day is the start day — most events are one day.
 */
export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "validation.required").max(300),
    notes,
    allDay: z.boolean(),
    startsOn: day,
    endsOn: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .refine((v) => v === null || isDay(v), "validation.invalidDate"),
    startTime: z.string().trim().nullable(),
    endTime: z.string().trim().nullable(),
    isMilestone: z.boolean(),
  })
  .transform((v, ctx) => {
    const endsOn = v.endsOn ?? v.startsOn;
    if (endsOn < v.startsOn) {
      ctx.addIssue({ code: "custom", path: ["endsOn"], message: "jobs.validation.endBeforeStart" });
      return z.NEVER;
    }
    if (v.allDay) return { ...v, endsOn, startTime: null, endTime: null };

    const start = time.safeParse(v.startTime ?? "");
    const end = time.safeParse(v.endTime ?? "");
    if (!start.success) ctx.addIssue({ code: "custom", path: ["startTime"], message: "jobs.schedule.validation.time" });
    if (!end.success) ctx.addIssue({ code: "custom", path: ["endTime"], message: "jobs.schedule.validation.time" });
    if (!start.success || !end.success) return z.NEVER;
    if (endsOn === v.startsOn && end.data < start.data) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "jobs.validation.endBeforeStart" });
      return z.NEVER;
    }
    return { ...v, endsOn, startTime: start.data, endTime: end.data };
  });

export type EventValues = z.infer<typeof eventSchema>;

export function eventFromForm(formData: FormData) {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return eventSchema.safeParse({
    title: text("title"),
    notes: text("notes"),
    allDay: formData.get("allDay") === "on",
    startsOn: text("startsOn"),
    endsOn: text("endsOn"),
    startTime: text("startTime") || null,
    endTime: text("endTime") || null,
    isMilestone: formData.get("isMilestone") === "on",
  });
}
