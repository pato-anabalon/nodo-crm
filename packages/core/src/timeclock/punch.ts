import { geofenceVerdict, type Fix, type Point } from "./geofence";

/**
 * The rules a punch on the clock answers to, apart from where the phone is
 * (`geofence.ts`). Pure, like the geofence: the phone asks them before it
 * queues a punch, the server again when the punch arrives.
 */

/** A phone's clock a little ahead of the server's is a phone, not a lie. */
export const PUNCH_FUTURE_TOLERANCE_MS = 5 * 60_000;
/** How long a punch made without signal may take to arrive. */
export const PUNCH_MAX_AGE_MS = 7 * 24 * 60 * 60_000;
/** A punch that took longer than this to arrive is shown as sent late. */
export const PUNCH_LATE_AFTER_MS = 10 * 60_000;

export type PunchTimeProblem = "punch_in_future" | "punch_too_old";

/**
 * The time the phone says the button was pressed is the one kept — a punch
 * made without signal arrives later, legitimately — within limits: not ahead
 * of the server beyond a clock's drift, and not older than a week.
 */
export function punchTimeProblem(at: Date, receivedAt: Date): PunchTimeProblem | null {
  const ahead = at.getTime() - receivedAt.getTime();
  if (ahead > PUNCH_FUTURE_TOLERANCE_MS) return "punch_in_future";
  if (-ahead > PUNCH_MAX_AGE_MS) return "punch_too_old";
  return null;
}

/** Whether a punch reached the server long after it was made — said on the timesheet, never refused. */
export function isLatePunch(at: Date, receivedAt: Date): boolean {
  return receivedAt.getTime() - at.getTime() > PUNCH_LATE_AFTER_MS;
}

export type ClockInRefusal = "no_site" | "outside" | "imprecise";

/**
 * Whether a clock-in at this fix is taken. Away from the job is refused, and so
 * is a guess too vague to tell; a job with no place on the map can't be
 * clocked into at all. Clocking out has no such rule: somebody who forgot and
 * drove home must still be able to end the day (`clockOutInside` records it).
 */
export function clockInRefusal(
  site: Point | null,
  radiusM: number,
  fix: Fix,
): { refusal: ClockInRefusal; distanceM?: number } | { refusal: null; distanceM: number } {
  const verdict = geofenceVerdict(site, radiusM, fix);
  switch (verdict.kind) {
    case "inside":
      return { refusal: null, distanceM: verdict.distanceM };
    case "no-site":
      return { refusal: "no_site" };
    case "outside":
      return { refusal: "outside", distanceM: verdict.distanceM };
    case "imprecise":
      return { refusal: "imprecise", distanceM: verdict.distanceM };
  }
}

/** Positions sent in one request; a day's queue on a phone that lost signal fits several times over. */
export const MAX_PINGS_PER_BATCH = 500;

/**
 * The positions that belong to a shift: recorded between its clock-in and its
 * clock-out (or, while it is open, up to the server's now plus a clock's
 * drift). A batch that arrives after the clock-out keeps what was recorded
 * before it; nothing is tracked outside the shift.
 */
export function withinShift<T extends { at: Date }>(pings: readonly T[], clockInAt: Date, clockOutAt: Date | null, now: Date): T[] {
  const end = clockOutAt?.getTime() ?? now.getTime() + PUNCH_FUTURE_TOLERANCE_MS;
  return pings.filter((ping) => ping.at.getTime() >= clockInAt.getTime() && ping.at.getTime() <= end);
}
