/**
 * Which quotes were made here, and which were brought in.
 *
 * A company that came over from another tool keeps thousands of old quotes,
 * some still `SENT`, that are still being worked in that tool: this platform
 * never emailed them and must not start chasing their customers now. The line
 * between the two is `Company.quoteNumberStart` — the importer numbers what it
 * brings in from 1, and the start is set above the last of them, so everything
 * made here is numbered at or above it. A company that never migrated leaves it
 * at 1, which makes every one of its quotes native and changes nothing for it.
 *
 * The rule belongs to whatever acts on quotes on its own, with nobody pressing
 * a button: the nightly sweep's follow-ups, review requests, expiry notices and
 * closing of expired quotes. A person acting on a quote by hand is unaffected.
 */

/** Whether a quote with this number was made on this platform. */
export function isNativeQuote(number: number, quoteNumberStart: number): boolean {
  return number >= quoteNumberStart;
}

/**
 * The same rule as a Prisma filter, for a sweep to spread into its `where`.
 * Kept beside `isNativeQuote` so the two can't be written differently.
 */
export function nativeQuoteWhere(quoteNumberStart: number): { number: { gte: number } } {
  return { number: { gte: quoteNumberStart } };
}
