import { geofenceVerdict, type Fix, type GeofenceVerdict } from "@nodo/core/timeclock/geofence";

/**
 * The clock as the phone sees it: what the server last said, with the punches
 * still waiting for signal laid on top. Pure, so what the screen shows after a
 * punch made in a basement is checked without a phone.
 */

export type ClockEntry = {
  id: string;
  clientId: string | null;
  job: { id: string | null; name: string };
  source: "MOBILE" | "MANUAL";
  clockInAt: string;
  clockOutAt: string | null;
  clockInDistanceM: number | null;
  clockOutInside: boolean | null;
  clockInLate: boolean;
  clockOutLate: boolean;
  note: string | null;
  edited: boolean;
};

export type ClockJob = {
  id: string;
  name: string;
  address: string | null;
  site: { latitude: number; longitude: number; radiusM: number } | null;
};

export type ClockOverview = { consentAt: string | null; open: ClockEntry | null; jobs: ClockJob[] };

export type EntriesPage = { from: string; to: string; entries: ClockEntry[] };

/** A punch made on the phone, kept until the server has it. `at` is when the button was pressed. */
export type Punch =
  | { kind: "in"; clientId: string; jobId: string; jobName: string; at: string; fix: Fix; battery: number | null }
  | { kind: "out"; entry: string; at: string; fix: Fix | null; battery: number | null };

export type ClockState =
  | { kind: "out" }
  | {
      kind: "in";
      /** The clientId the shift was clocked in with: what clocking out names. */
      entry: string;
      jobName: string;
      since: string;
      /** Only on this phone so far. */
      pending: boolean;
    };

/**
 * The shift in progress, if any: a queued clock-out ends it, a queued clock-in
 * starts one, otherwise it is whatever the server has open. A shift entered by
 * hand on the web has no clientId, and the phone can't clock out of it.
 */
export function clockState(open: ClockEntry | null, queue: readonly Punch[]): ClockState {
  const lastIn = [...queue].reverse().find((punch) => punch.kind === "in");
  const closed = (entry: string) => queue.some((punch) => punch.kind === "out" && punch.entry === entry);

  if (lastIn && lastIn.kind === "in" && !closed(lastIn.clientId)) {
    return { kind: "in", entry: lastIn.clientId, jobName: lastIn.jobName, since: lastIn.at, pending: true };
  }
  if (open?.clientId && !closed(open.clientId)) {
    return { kind: "in", entry: open.clientId, jobName: open.job.name, since: open.clockInAt, pending: false };
  }
  return { kind: "out" };
}

export type JobNearby = ClockJob & { verdict: GeofenceVerdict | null };

/**
 * The jobs to clock into, nearest first, each with what the phone would be
 * told for it right now. Without a fix yet they keep the server's order.
 */
export function jobsNearby(jobs: readonly ClockJob[], fix: Fix | null): JobNearby[] {
  const withVerdict = jobs.map((job) => ({
    ...job,
    verdict: fix ? geofenceVerdict(job.site, job.site?.radiusM ?? 0, fix) : null,
  }));
  if (!fix) return withVerdict;
  const distance = (job: JobNearby) => (job.verdict && job.verdict.kind !== "no-site" ? job.verdict.distanceM : Infinity);
  return withVerdict.sort((a, b) => distance(a) - distance(b));
}

/** What a punch the server refused takes with it: a clock-in that never happened leaves nothing to clock out of. */
export function withoutRefused(queue: readonly Punch[], refused: Punch): Punch[] {
  const entry = refused.kind === "in" ? refused.clientId : null;
  return queue.filter((punch) => punch !== refused && !(entry && punch.kind === "out" && punch.entry === entry));
}

/** Seconds since `since`, never negative: a phone clock a moment behind the punch's own. */
export function elapsedSeconds(since: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
}

/** `7:05:09` — a running clock, hours not padded. */
export function stopwatch(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
