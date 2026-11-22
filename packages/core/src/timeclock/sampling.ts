/**
 * How often the phone records where it is during a shift, and when it sends
 * what it recorded. The battery is the constraint, not the database: GPS at
 * full precision all day costs a quarter of a battery or more, so the phone
 * asks only as often as the situation can change. Pure, so the intervals are
 * checked without a phone and tuned from the pilot's numbers in one place.
 *
 * - **On the job and still**: the place is already known — a position every
 *   fifteen minutes is enough to show they stayed.
 * - **Moving**: every two minutes or fifty metres, so a drive reads as a line.
 * - **Away from the job, not moving**: every five minutes — what the
 *   supervisor will look at if the shift ends by itself.
 *
 * Balanced precision throughout (wifi and towers, ample for a circle of
 * hundreds of metres); high precision is for the few seconds of a punch,
 * which is when precision decides something.
 */

export type SamplingMode = "still_on_site" | "moving" | "still_away";

export type Sampling = {
  mode: SamplingMode;
  /** At most one position per this long. */
  intervalMs: number;
  /** And no new one until the phone has moved this far, when it is moving. */
  distanceM: number;
  accuracy: "balanced";
};

/**
 * Faster than this is moving somewhere, slower is getting on with the job:
 * walking around a site, at 1–1.5 m/s, must not read as leaving it.
 */
export const MOVING_SPEED_MPS = 2.5;

const MINUTE = 60_000;

const SAMPLING: Record<SamplingMode, Omit<Sampling, "mode" | "accuracy">> = {
  still_on_site: { intervalMs: 15 * MINUTE, distanceM: 100 },
  moving: { intervalMs: 2 * MINUTE, distanceM: 50 },
  still_away: { intervalMs: 5 * MINUTE, distanceM: 50 },
};

/**
 * The sampling for what the phone last knew. `speedMps` is the fix's own
 * (null when it reported none, which reads as still); `inside` is the job's
 * geofence, as the system last reported it.
 */
export function samplingFor(input: { inside: boolean; speedMps: number | null }): Sampling {
  const moving = input.speedMps !== null && input.speedMps >= MOVING_SPEED_MPS;
  const mode: SamplingMode = moving ? "moving" : input.inside ? "still_on_site" : "still_away";
  return { mode, ...SAMPLING[mode], accuracy: "balanced" };
}

/**
 * Positions go up in batches, not one by one: with poor signal the radio
 * spends as much as the GPS does. Sooner when the queue grows, and always at
 * clock-out, so the shift's track is whole when it closes.
 */
export const FLUSH_EVERY_MS = 20 * MINUTE;
export const FLUSH_AT_QUEUED = 30;

export function shouldFlush(input: { queued: number; oldestQueuedAt: Date | null; now: Date; clockingOut: boolean }): boolean {
  if (input.queued === 0 || !input.oldestQueuedAt) return false;
  if (input.clockingOut) return true;
  if (input.queued >= FLUSH_AT_QUEUED) return true;
  return input.now.getTime() - input.oldestQueuedAt.getTime() >= FLUSH_EVERY_MS;
}

