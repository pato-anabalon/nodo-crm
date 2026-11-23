/**
 * Leaving the job during a shift, coming back, an errand, and travel between
 * jobs. Pure, like the rest of the clock: the phone reads it to say how long is
 * left, the server to decide when a shift ended by itself.
 *
 * A shift on a job hears about the circle through events the phone sends as
 * the system reports them — `LEFT` and `RETURNED` — and the person's own
 * `ERRAND`, which says the time away is work: a trip to the merchant for
 * materials. Events are folded in the order they happened, not the order they
 * arrived, so a phone that spent the drive without signal tells the same story
 * as one that had it.
 *
 * With the company's `returnMinutes` on, somebody who leaves and isn't back
 * within it — and isn't on an errand — is clocked out **at the moment they
 * left**: the time away was not on the job. Travel to another job is its own
 * stretch (`TRAVEL`, paid), which ends by arriving somewhere or, forgotten,
 * at the company's `travelMaxMinutes`.
 */

export type SiteEventKind = "LEFT" | "RETURNED" | "ERRAND";

export type SiteEvent = { kind: SiteEventKind; at: Date };

export type MovementPolicy = {
  /** How long somebody may be away from the job before the shift ends by itself; 0 is never. */
  returnMinutes: number;
  /** How long inside another job before the phone suggests switching to it. */
  switchMinutes: number;
  /** The longest a stretch of travel runs before it ends by itself. */
  travelMaxMinutes: number;
};

export const DEFAULT_MOVEMENT_POLICY: MovementPolicy = { returnMinutes: 0, switchMinutes: 5, travelMaxMinutes: 120 };

/** What a company may choose, the database holds them to the same. */
export const RETURN_MINUTES_OPTIONS = [0, 10, 15, 20, 30, 45, 60] as const;
export const SWITCH_MINUTES_OPTIONS = [2, 5, 10, 15] as const;
export const TRAVEL_MAX_MINUTES_OPTIONS = [30, 60, 90, 120, 180] as const;

/** Events sent in one request: a day's worth of comings and goings, many times over. */
export const MAX_SITE_EVENTS_PER_BATCH = 100;

export type Errand = { from: Date; to: Date | null };

export type SiteState = {
  /** Out of the job's circle as far as the events say. */
  outside: boolean;
  /** When they last left, while still out. */
  leftAt: Date | null;
  /** Every errand, the last still open while `to` is null. */
  errands: Errand[];
  /** When the shift ends by itself unless they come back; null when nothing is counting down. */
  deadline: Date | null;
  /** The shift ended by itself, at the moment they left; null while it hasn't. */
  endedAt: Date | null;
};

const minutes = (count: number) => count * 60_000;

/**
 * Where a shift on a job stands after `events`, as of `now`.
 *
 * - `LEFT` while inside starts the countdown; another while already out changes nothing.
 * - `RETURNED` while out stops it, and closes an errand that was open.
 * - `ERRAND` opens one, out or still inside — a person may say so before driving off —
 *   and while it is open nothing counts down. It closes on returning.
 * - Anything that happens after the countdown ran out comes too late: the shift
 *   had already ended when they left, and coming back doesn't reopen it.
 */
export function siteState(events: readonly SiteEvent[], policy: MovementPolicy, now: Date): SiteState {
  const ordered = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  let leftAt: Date | null = null;
  const errands: Errand[] = [];
  const errandOpen = () => errands.length > 0 && errands[errands.length - 1].to === null;
  const deadline = () =>
    leftAt && !errandOpen() && policy.returnMinutes > 0 ? new Date(leftAt.getTime() + minutes(policy.returnMinutes)) : null;
  const ranOut = (at: Date) => {
    const limit = deadline();
    return limit !== null && at > limit;
  };

  for (const event of ordered) {
    if (ranOut(event.at)) return { outside: true, leftAt, errands, deadline: deadline(), endedAt: leftAt };
    switch (event.kind) {
      case "LEFT":
        leftAt ??= event.at;
        break;
      case "RETURNED":
        if (errandOpen()) errands[errands.length - 1].to = event.at;
        leftAt = null;
        break;
      case "ERRAND":
        if (!errandOpen()) errands.push({ from: event.at, to: null });
        break;
    }
  }

  return { outside: leftAt !== null, leftAt, errands, deadline: deadline(), endedAt: ranOut(now) ? leftAt : null };
}

/** When a stretch of travel that started at `startedAt` ends if nobody ends it. */
export function travelDeadline(startedAt: Date, policy: MovementPolicy): Date {
  return new Date(startedAt.getTime() + minutes(policy.travelMaxMinutes));
}

export type EntryKind = "WORK" | "TRAVEL";
export type EntryEnd = "PUNCH" | "LEFT_SITE" | "SWITCHED" | "TRAVEL_LIMIT";

export type SettlingEntry = {
  kind: EntryKind;
  clockInAt: Date;
  clockOutAt: Date | null;
  endedBy: EntryEnd | null;
  /** A supervisor put it right: what they set stands, whatever the events say. */
  edited: boolean;
};

export type Settlement =
  | { action: "close"; at: Date; endedBy: "LEFT_SITE" | "TRAVEL_LIMIT" }
  | { action: "reopen" }
  | null;

/**
 * What the clock does with a shift by itself, given everything it has heard.
 *
 * An open shift on a job closes at the moment they left once the countdown ran
 * out; travel closes at its limit. A shift the clock closed by itself is the
 * clock's conclusion, not a person's, so news that arrives late changes it: a
 * `RETURNED` sent from a phone that had no signal on the way back, dated in
 * time, reopens it, and a later departure moves its end. Nothing the person or
 * a supervisor ended is ever touched.
 */
export function settlement(entry: SettlingEntry, events: readonly SiteEvent[], policy: MovementPolicy, now: Date): Settlement {
  if (entry.edited) return null;

  if (entry.kind === "TRAVEL") {
    if (entry.clockOutAt) return null;
    const limit = travelDeadline(entry.clockInAt, policy);
    return now > limit ? { action: "close", at: limit, endedBy: "TRAVEL_LIMIT" } : null;
  }

  if (entry.clockOutAt && entry.endedBy !== "LEFT_SITE") return null;
  const state = siteState(events, policy, now);
  if (state.endedAt) {
    return entry.clockOutAt?.getTime() === state.endedAt.getTime()
      ? null
      : { action: "close", at: state.endedAt, endedBy: "LEFT_SITE" };
  }
  // With the countdown since turned off there is nothing to measure a return against.
  return entry.clockOutAt && policy.returnMinutes > 0 ? { action: "reopen" } : null;
}
