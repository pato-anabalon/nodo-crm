import { z } from "zod";
import { isDay } from "@nodo/core/jobs/schedule/calendar";
import { MEAL_BREAK_MAX_MINUTES } from "@nodo/core/timeclock/pay";
import { MAX_SITE_EVENTS_PER_BATCH } from "@nodo/core/timeclock/movement";
import { MAX_PINGS_PER_BATCH } from "@nodo/core/timeclock/punch";

/**
 * What the app posts to the clock. Instants are ISO with an offset, the time
 * the button was pressed on the phone; ids are the phone's own, made once per
 * punch, which is what lets a punch queued without signal be sent until it lands.
 */

const instant = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const clientId = z.string().min(8).max(64);

const fix = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  // A phone reports how sure it is in metres; nothing it says is wider than a city.
  accuracyM: z.number().positive().max(50_000),
});

const battery = z.number().min(0).max(1).nullable().optional();

export const clockInSchema = z.object({
  jobId: z.string().min(1).max(64),
  clientId,
  at: instant,
  fix,
  battery,
});

/** `entry` is the clientId the shift was clocked in with: the phone knows it before the server answers. */
export const clockOutSchema = z.object({
  entry: clientId,
  at: instant,
  // Without a fix — GPS off, indoors — the shift still ends; where is simply not recorded.
  fix: fix.nullable().optional(),
  battery,
});

export const pingsSchema = z.object({
  entry: clientId,
  pings: z
    .array(
      fix.extend({
        at: instant,
        speedMps: z.number().min(0).max(100).nullable().optional(),
      }),
    )
    .min(1)
    .max(MAX_PINGS_PER_BATCH),
});

export const consentSchema = z.object({ consent: z.boolean() });

/**
 * A supervisor's correction or a shift entered by hand, as the form posts it:
 * a day and wall-clock times on the company's calendar, which the service
 * turns into instants. An empty end leaves a shift open. Every change to
 * somebody's hours says why.
 */
const time = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "timesheets.corrections.validation.time");
const reason = z.string().trim().min(1, "validation.required").max(500, "validation.maxChars|max=500");

export const shiftSchema = z.object({
  jobId: z.string().trim().min(1, "validation.required").max(64),
  day: z.string().trim().refine(isDay, "validation.invalidDate"),
  start: time,
  end: z.union([z.literal(""), time]).transform((value) => value || null),
  reason,
});

export type ShiftValues = z.infer<typeof shiftSchema>;

export const deleteShiftSchema = z.object({ reason });

/** The meal break taken on a day, in minutes; empty puts the day back on the company's. */
export const mealSchema = z.object({
  day: z.string().trim().refine(isDay, "validation.invalidDate"),
  minutes: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || (Number.isInteger(value) && value >= 0 && value <= MEAL_BREAK_MAX_MINUTES), "timesheets.corrections.validation.meal"),
  reason,
});

/** What the phone heard about the job's circle, and the errands declared, for the shift clocked in with `entry`. */
export const siteEventsSchema = z.object({
  entry: clientId,
  events: z
    .array(
      z.object({
        clientId,
        kind: z.enum(["LEFT", "RETURNED", "ERRAND"]),
        at: instant,
        note: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .min(1)
    .max(MAX_SITE_EVENTS_PER_BATCH),
});

/** Leaving the job in `entry` for another: travel, made with its own `clientId`. */
export const travelSchema = z.object({ entry: clientId, clientId, at: instant });

/** Arriving at `jobId` and taking it up, ending whatever `from` is — a shift or the travel since. */
export const switchSchema = z.object({
  from: clientId,
  jobId: z.string().min(1).max(64),
  clientId,
  at: instant,
  fix,
  battery,
});
