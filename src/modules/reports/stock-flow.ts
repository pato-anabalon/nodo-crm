import type { Range } from "./service";

/**
 * A mirror, in plain booleans, of the four `where` clauses `quoteBreakdown`
 * runs in the database.
 *
 * It exists to make one claim checkable without a database: that `sent`,
 * `accepted`, `declined`, `expired` and `awaiting` are a true partition — every
 * quote open at a period's start, plus every one sent during it, ends up in
 * exactly one of `decided`, `expired` or still `awaiting` at the close. Get
 * that wrong and the figures on the Reports page quietly stop adding up, the
 * way `awaiting` alone used to before `expired` existed.
 *
 * This is a second copy of the logic, not the one Postgres runs — a Prisma
 * `where` is a query plan, not a function this module can call. Change a
 * condition in `quoteBreakdown` and this one has to follow, or the test below
 * stops meaning anything.
 */
export type QuoteLike = {
  sentAt: Date | null;
  decidedAt: Date | null;
  validUntil: Date | null;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
};

/**
 * The instant a period is "closed" at, for the figures that are a stock.
 *
 * The period's own end — unless that is still ahead of us. A year in progress
 * ends on 1 January, but a quote valid until November has not run out yet, and
 * reading the stock *as of next January* counted it as expired: the card for
 * "awaiting acceptance" showed nothing while ten quotes were genuinely open, and
 * every one of them was counted as expired instead. For a period still open the
 * close is now, and nothing later than now has happened.
 */
export function closeOf(period: Range, now: Date): Date {
  return period.to.getTime() <= now.getTime() ? period.to : now;
}

export function wasSentWithin(quote: QuoteLike, period: Range): boolean {
  return quote.sentAt !== null && quote.sentAt >= period.from && quote.sentAt < period.to;
}

/** Mirrors the `decided` query: accepted or declined, by `decidedAt`. */
export function wasDecidedWithin(quote: QuoteLike, period: Range): boolean {
  return (
    (quote.status === "ACCEPTED" || quote.status === "REJECTED") &&
    quote.decidedAt !== null &&
    quote.decidedAt >= period.from &&
    quote.decidedAt < period.to
  );
}

/**
 * Mirrors the `expired` query: sent, never decided, and its validity ran out
 * within the period — never keyed on `status`, since nothing in this app
 * flips a live quote to `EXPIRED` on its own.
 *
 * "Ran out" stops at the close (`closeOf`): a validity date still ahead of us
 * has not run out, even when it falls inside a period that hasn't ended.
 */
export function wasExpiredWithin(quote: QuoteLike, period: Range, now: Date = period.to): boolean {
  return (
    quote.sentAt !== null &&
    quote.decidedAt === null &&
    quote.validUntil !== null &&
    quote.validUntil >= period.from &&
    quote.validUntil < closeOf(period, now)
  );
}

/**
 * Mirrors the `awaiting` query, at either end of a period: sent before
 * `instant`, and as of `instant` neither decided nor run out.
 */
export function wasAwaitingAt(quote: QuoteLike, instant: Date): boolean {
  return (
    quote.sentAt !== null &&
    quote.sentAt < instant &&
    (quote.decidedAt === null || quote.decidedAt >= instant) &&
    (quote.validUntil === null || quote.validUntil >= instant)
  );
}
