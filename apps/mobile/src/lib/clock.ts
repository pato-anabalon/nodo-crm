import { geofenceVerdict, type Fix, type GeofenceVerdict } from "@nodo/core/timeclock/geofence";
import {
  DEFAULT_MOVEMENT_POLICY,
  MAX_SITE_EVENTS_PER_BATCH,
  siteState,
  travelDeadline,
  type MovementPolicy,
  type SiteEvent,
  type SiteEventKind,
} from "@nodo/core/timeclock/movement";

/**
 * The clock as the phone sees it: what the server last said, with the punches
 * still waiting for signal laid on top. Pure, so what the screen shows after a
 * punch made in a basement is checked without a phone.
 */

export type ClockEntry = {
  id: string;
  clientId: string | null;
  job: { id: string | null; name: string };
  kind: "WORK" | "TRAVEL";
  source: "MOBILE" | "MANUAL";
  clockInAt: string;
  clockOutAt: string | null;
  clockInDistanceM: number | null;
  clockOutInside: boolean | null;
  endedBy: "PUNCH" | "LEFT_SITE" | "SWITCHED" | "TRAVEL_LIMIT" | null;
  clockInLate: boolean;
  clockOutLate: boolean;
  note: string | null;
  edited: boolean;
};

/** The shift open now, as the server settled it: away from the job and until when, or travelling until when. */
export type OpenEntry = ClockEntry & {
  away: { leftAt: string; until: string | null; errandSince: string | null } | null;
  travelEndsAt: string | null;
};

export type ClockJob = {
  id: string;
  name: string;
  address: string | null;
  site: { latitude: number; longitude: number; radiusM: number } | null;
};

export type ClockOverview = {
  consentAt: string | null;
  open: OpenEntry | null;
  jobs: ClockJob[];
  movement: MovementPolicy;
  retentionDays: number;
};

export type EntriesPage = { from: string; to: string; entries: ClockEntry[] };

/**
 * Something done on the phone, kept until the server has it, in the order it
 * was done. `at` is when it happened — the button, or the system saying the
 * phone crossed the job's circle. Every one carries its own id, so sending it
 * twice is stored once.
 */
export type Punch =
  | { kind: "in"; clientId: string; jobId: string; jobName: string; at: string; fix: Fix; battery: number | null }
  | { kind: "out"; entry: string; at: string; fix: Fix | null; battery: number | null }
  | { kind: "event"; entry: string; clientId: string; event: SiteEventKind; at: string }
  | { kind: "travel"; entry: string; clientId: string; at: string }
  | { kind: "switch"; from: string; clientId: string; jobId: string; jobName: string; at: string; fix: Fix; battery: number | null };

export type Away = {
  leftAt: string;
  /** When the shift ends by itself unless they're back; null when the company doesn't end it, or on an errand. */
  until: string | null;
  errand: boolean;
};

export type ClockState =
  | { kind: "out" }
  | {
      kind: "in";
      /** The clientId the shift was clocked in with: what clocking out names. */
      entry: string;
      jobId: string | null;
      jobName: string;
      since: string;
      /** Only on this phone so far. */
      pending: boolean;
      away: Away | null;
    }
  | {
      kind: "travel";
      entry: string;
      /** The job they left. */
      fromJob: string;
      since: string;
      pending: boolean;
      /** When the travel ends by itself if they arrive nowhere. */
      endsAt: string;
    };

type Stretch =
  | { work: true; entry: string; jobId: string | null; jobName: string; since: string; pending: boolean; events: SiteEvent[] }
  | { work: false; entry: string; fromJob: string; since: string; pending: boolean; endsAt: string | null };

/**
 * What is open now: the server's open shift with everything queued since
 * folded over it in order — a clock-in starts a shift, a clock-out ends the one
 * it names, leaving and coming back move the countdown, travel ends the shift
 * where they left it, a switch starts the next job. The countdown is the
 * server's own rule (`siteState`), so a shift the clock would have ended by
 * now reads as ended here too. A shift entered by hand on the web has no
 * clientId, and the phone can't act on it.
 */
export function clockState(
  open: OpenEntry | null,
  queue: readonly Punch[],
  policy: MovementPolicy = DEFAULT_MOVEMENT_POLICY,
  now: number = Date.now(),
): ClockState {
  let stretch = fromServer(open);
  for (const punch of queue) {
    switch (punch.kind) {
      case "in":
        stretch = { work: true, entry: punch.clientId, jobId: punch.jobId, jobName: punch.jobName, since: punch.at, pending: true, events: [] };
        break;
      case "out":
        if (stretch?.entry === punch.entry) stretch = null;
        break;
      case "event":
        if (stretch?.work && stretch.entry === punch.entry) {
          stretch = { ...stretch, events: [...stretch.events, { kind: punch.event, at: new Date(punch.at) }] };
        }
        break;
      case "travel":
        if (stretch?.work && stretch.entry === punch.entry) {
          const leftAt = siteState(stretch.events, policy, new Date(now)).leftAt;
          stretch = { work: false, entry: punch.clientId, fromJob: stretch.jobName, since: leftAt?.toISOString() ?? punch.at, pending: true, endsAt: null };
        }
        break;
      case "switch":
        // With nothing open the server takes it as a clock-in, after what the clock ended.
        if (!stretch || stretch.entry === punch.from) {
          stretch = { work: true, entry: punch.clientId, jobId: punch.jobId, jobName: punch.jobName, since: punch.at, pending: true, events: [] };
        }
        break;
    }
  }
  if (!stretch) return { kind: "out" };

  if (!stretch.work) {
    const endsAt = stretch.endsAt ?? travelDeadline(new Date(stretch.since), policy).toISOString();
    if (Date.parse(endsAt) < now) return { kind: "out" };
    return { kind: "travel", entry: stretch.entry, fromJob: stretch.fromJob, since: stretch.since, pending: stretch.pending, endsAt };
  }

  const site = siteState(stretch.events, policy, new Date(now));
  if (site.endedAt) return { kind: "out" };
  const errand = site.errands.at(-1);
  return {
    kind: "in",
    entry: stretch.entry,
    jobId: stretch.jobId,
    jobName: stretch.jobName,
    since: stretch.since,
    pending: stretch.pending,
    away: site.leftAt ? { leftAt: site.leftAt.toISOString(), until: site.deadline?.toISOString() ?? null, errand: !!errand && errand.to === null } : null,
  };
}

/** The server's open shift as the fold starts from; its time away put back as the events that made it. */
function fromServer(open: OpenEntry | null): Stretch | null {
  if (!open?.clientId) return null;
  if (open.kind === "TRAVEL") {
    return { work: false, entry: open.clientId, fromJob: open.job.name, since: open.clockInAt, pending: false, endsAt: open.travelEndsAt };
  }
  const events: SiteEvent[] = [];
  if (open.away) events.push({ kind: "LEFT", at: new Date(open.away.leftAt) });
  if (open.away?.errandSince) events.push({ kind: "ERRAND", at: new Date(open.away.errandSince) });
  return { work: true, entry: open.clientId, jobId: open.job.id, jobName: open.job.name, since: open.clockInAt, pending: false, events };
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

/**
 * What a punch the server refused takes with it: a shift that never started
 * leaves nothing to clock out of, leave or travel from — and the same for
 * whatever started from that, all the way down.
 */
export function withoutRefused(queue: readonly Punch[], refused: Punch): Punch[] {
  const gone = new Set<string>();
  const started = (punch: Punch) => (punch.kind === "in" || punch.kind === "travel" || punch.kind === "switch" ? punch.clientId : null);
  const from = (punch: Punch) => (punch.kind === "switch" ? punch.from : punch.kind === "in" ? null : punch.entry);
  const id = started(refused);
  if (id) gone.add(id);
  return queue.filter((punch) => {
    if (punch === refused) return false;
    const parent = from(punch);
    if (parent === null || !gone.has(parent)) return true;
    const child = started(punch);
    if (child) gone.add(child);
    return false;
  });
}

/** The punches one request carries: one, or a run of events for the same shift together. */
export function nextBatch(queue: readonly Punch[]): Punch[] {
  const first = queue[0];
  if (!first) return [];
  if (first.kind !== "event") return [first];
  const run: Punch[] = [];
  for (const punch of queue) {
    if (punch.kind !== "event" || punch.entry !== first.entry || run.length >= MAX_SITE_EVENTS_PER_BATCH) break;
    run.push(punch);
  }
  return run;
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
