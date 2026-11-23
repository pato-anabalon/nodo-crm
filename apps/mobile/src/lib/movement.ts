import { distanceM, type Point } from "@nodo/core/timeclock/geofence";
import { MAX_PINGS_PER_BATCH } from "@nodo/core/timeclock/punch";
import type { ClockJob } from "./clock";

/**
 * What the phone does with the system's word that it crossed a job's circle,
 * during a shift. Pure, so the decisions are checked without a phone; the
 * background task (`tracking.ts`) only carries them out.
 *
 * The system reports a crossing, not a state, and it may report the state it
 * found when the circles were first handed over. So the phone keeps what it
 * last believed for each circle (`Watch`) and acts only on a change: a shift
 * clocked in inside its job starts out believed inside, and the first "inside"
 * it hears changes nothing.
 */

export type Watch = {
  /** The clientId of the stretch open when the circles were handed over. */
  entry: string;
  /** Its job; null while travelling. */
  jobId: string | null;
  /** What was last believed about each circle, by job id. */
  inside: Record<string, boolean>;
};

export function watchFor(entry: string, jobId: string | null): Watch {
  return { entry, jobId, inside: jobId ? { [jobId]: true } : {} };
}

export type Reaction = {
  /** What to tell the server about the shift's own job. */
  event?: "LEFT" | "RETURNED";
  /** Another job they arrived at: suggest switching to it once they've stayed. */
  suggest?: string;
  /** Another job they left again before the suggestion came: take it back. */
  withdraw?: string;
};

export function reactTo(watch: Watch, change: { jobId: string; entered: boolean }): { watch: Watch; reaction: Reaction } {
  const before = watch.inside[change.jobId];
  const next = { ...watch, inside: { ...watch.inside, [change.jobId]: change.entered } };
  if (before === change.entered) return { watch: next, reaction: {} };

  if (change.jobId === watch.jobId) return { watch: next, reaction: { event: change.entered ? "RETURNED" : "LEFT" } };
  // Unknown counts as outside for another job: arriving is news, leaving one never entered isn't.
  if (change.entered) return { watch: next, reaction: { suggest: change.jobId } };
  return { watch: next, reaction: before === true ? { withdraw: change.jobId } : {} };
}

/** iOS watches at most twenty circles per app; Android a hundred. Twenty for both. */
export const MAX_REGIONS = 20;

const MIN_REGION_RADIUS_M = 100;

export type Region = { identifier: string; latitude: number; longitude: number; radius: number };

const PREFIX = "job:";

export const regionJobId = (identifier: string | undefined): string | null =>
  identifier?.startsWith(PREFIX) ? identifier.slice(PREFIX.length) : null;

/**
 * The circles to hand the system: the shift's own job first, then the other
 * jobs nearest to `near` — the job's own place, or where travel last was.
 */
export function regionsFor(jobs: readonly ClockJob[], ownJobId: string | null, near: Point | null): Region[] {
  const placed = jobs.filter((job) => job.site);
  const own = placed.find((job) => job.id === ownJobId);
  const centre = near ?? own?.site ?? null;
  const others = placed
    .filter((job) => job.id !== ownJobId)
    .map((job) => ({ job, distance: centre ? distanceM(centre, job.site!) : 0 }))
    .sort((a, b) => a.distance - b.distance)
    .map(({ job }) => job);
  return [...(own ? [own] : []), ...others].slice(0, MAX_REGIONS).map((job) => ({
    identifier: `${PREFIX}${job.id}`,
    latitude: job.site!.latitude,
    longitude: job.site!.longitude,
    // The system is vague under a hundred metres: a smaller circle only learns of a departure later.
    radius: Math.max(job.site!.radiusM, MIN_REGION_RADIUS_M),
  }));
}

/** A position recorded during a shift, waiting to go up with the stretch it belongs to. */
export type QueuedPing = { entry: string; at: string; latitude: number; longitude: number; accuracyM: number; speedMps: number | null };

/** The next request's worth: the oldest positions of one stretch, as many as a batch takes. */
export function nextPingBatch(queue: readonly QueuedPing[]): QueuedPing[] {
  const first = queue[0];
  if (!first) return [];
  const batch: QueuedPing[] = [];
  for (const ping of queue) {
    if (ping.entry !== first.entry || batch.length >= MAX_PINGS_PER_BATCH) break;
    batch.push(ping);
  }
  return batch;
}

/** A phone reports −1 for a speed it doesn't know, and an accuracy it can't give as null. */
export function pingFrom(entry: string, location: { timestamp: number; coords: { latitude: number; longitude: number; accuracy: number | null; speed: number | null } }): QueuedPing {
  const { latitude, longitude, accuracy, speed } = location.coords;
  return {
    entry,
    at: new Date(location.timestamp).toISOString(),
    latitude,
    longitude,
    accuracyM: Math.min(Math.max(accuracy ?? 9_999, 1), 50_000),
    speedMps: speed !== null && speed >= 0 ? Math.min(speed, 100) : null,
  };
}
