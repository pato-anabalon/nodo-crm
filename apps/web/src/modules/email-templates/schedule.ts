import { QuoteStatus } from "@/generated/prisma/enums";

const DAY = 24 * 60 * 60 * 1000;

/** Everything the decision needs, and nothing that requires a database. */
export type ScheduledQuote = {
  status: QuoteStatus;
  sentAt: Date | null;
  decidedAt: Date | null;
  validUntil: Date | null;
  /** A link the company deliberately closed. */
  shareRevokedAt: Date | null;
  /** Whether the customer has said anything in the thread. */
  customerHasWritten: boolean;
  /** Whether this exact email already went out for this quote. */
  alreadySent: boolean;
};

export function daysSince(from: Date, now: Date): number {
  return (now.getTime() - from.getTime()) / DAY;
}

/**
 * Whether to nudge a customer who hasn't answered.
 *
 * Four things stop it beyond the calendar, and each is a way of not being the
 * company that keeps talking after the conversation moved on:
 *
 * - **It already went.** The sweep sees the same quote every night; the log is
 *   what keeps one reminder from becoming a nightly one.
 * - **The quote was answered.** Accepted or declined, there is nothing to chase.
 * - **It ran out.** Pressing somebody about a price that no longer stands is
 *   worse than saying nothing, and the team already gets its own "about to
 *   expire" notice.
 * - **The customer wrote.** Somebody who replied "we're discussing it
 *   internally, give us a week" and gets an automated reminder two days later
 *   doesn't read diligence — they read that nobody looked at their message.
 *
 * A revoked link stops it too: chasing with a link that no longer opens is a
 * dead end with the company's name on it.
 */
export function shouldFollowUp(
  quote: ScheduledQuote,
  afterDays: number,
  now: Date = new Date(),
): boolean {
  if (quote.alreadySent) return false;
  if (quote.status !== QuoteStatus.SENT) return false;
  if (!quote.sentAt) return false;
  if (quote.shareRevokedAt) return false;
  if (quote.customerHasWritten) return false;
  if (quote.validUntil && quote.validUntil.getTime() <= now.getTime()) return false;

  return daysSince(quote.sentAt, now) >= afterDays;
}

/**
 * Whether to ask an accepted customer for a review.
 *
 * Counted from the acceptance rather than the send: the wait is meant to be
 * long enough that the work has started, not that the quote is old.
 *
 * Nothing about the thread stops this one. A customer who accepted and then
 * asked a question is exactly who is worth asking.
 */
export function shouldAskForReview(
  quote: ScheduledQuote,
  afterDays: number,
  now: Date = new Date(),
): boolean {
  if (quote.alreadySent) return false;
  if (quote.status !== QuoteStatus.ACCEPTED) return false;
  if (!quote.decidedAt) return false;

  return daysSince(quote.decidedAt, now) >= afterDays;
}
