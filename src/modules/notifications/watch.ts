import { IngestOutcome } from "@/generated/prisma/enums";

/**
 * The decisions the daily sweep makes, kept away from the queries.
 *
 * Each one is a judgement about when something is worth interrupting somebody
 * over, and those are exactly the rules worth pinning down with tests rather
 * than tuning by feel against a live database.
 */

/** How long before a quote runs out that its author should hear about it. */
export const EXPIRING_WITHIN_DAYS = 3;

/**
 * A quote worth chasing: sent, unanswered, and about to run out.
 *
 * Already-expired ones are included — the point is to get somebody to act, and
 * a quote that lapsed yesterday is more urgent than one lapsing tomorrow, not
 * less.
 */
export function isExpiring(
  quote: { validUntil: Date | null },
  now: Date = new Date(),
  withinDays: number = EXPIRING_WITHIN_DAYS,
): boolean {
  if (!quote.validUntil) return false;
  const deadline = now.getTime() + withinDays * 86_400_000;
  return quote.validUntil.getTime() <= deadline;
}

/**
 * Rejections that mean the form will never work until somebody changes
 * something.
 *
 * A rate limit and a duplicate are the defences doing their job, not a fault;
 * counting them would cry wolf at a busy afternoon or a double click.
 */
const BROKEN_OUTCOMES: readonly IngestOutcome[] = [
  IngestOutcome.INVALID_KEY,
  IngestOutcome.REVOKED_KEY,
  IngestOutcome.ORIGIN_NOT_ALLOWED,
  IngestOutcome.INVALID_PAYLOAD,
  IngestOutcome.PAYLOAD_TOO_LARGE,
];

export function isBrokenOutcome(outcome: IngestOutcome): boolean {
  return BROKEN_OUTCOMES.includes(outcome);
}

/** Below this, a stray rejection is noise rather than a broken form. */
export const BROKEN_THRESHOLD = 3;

/**
 * Whether a company's web form looks broken.
 *
 * Needs both halves: rejections piling up **and** nothing getting through. A
 * site that takes a hundred leads and rejects three is working; one that takes
 * none and rejects three has been quietly losing every enquiry.
 */
export function formLooksBroken(counts: { rejected: number; accepted: number }): boolean {
  return counts.rejected >= BROKEN_THRESHOLD && counts.accepted === 0;
}

/** One notice per company per day, however many times the sweep runs. */
export function dailyKey(prefix: string, id: string, on: Date): string {
  return `${prefix}:${id}:${on.toISOString().slice(0, 10)}`;
}
