import { z } from "zod";
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
