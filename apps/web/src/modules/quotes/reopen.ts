import { QuoteStatus } from "@/generated/prisma/enums";
import { isNativeQuote } from "./native";

/**
 * Whether an expired quote may be given a new date and put back in front of
 * the customer. Pure, so the button and the action give the same answer.
 *
 * Running out is still the clock's, and still happens on its own: this is the
 * company deciding afterwards to hold the price for longer, on the same quote —
 * the alternative was a duplicate, two quotes for one job in every report.
 *
 * - **Only `EXPIRED`.** A declined quote is the customer's answer, an accepted
 *   one is frozen; neither is a date that passed.
 * - **Only a quote made here.** One brought in from another tool is that
 *   tool's to close, and the sweep never looks at it: reopened, it would sit
 *   `SENT` past its new date forever.
 * - **A date still ahead**, by the same comparison that expires it
 *   (`hasExpired`), or the sweep would close it again tonight.
 */
export type ReopenRefusal = "not-expired" | "imported" | "date-required" | "date-past";

export function reopenRefusal(
  quote: { status: QuoteStatus; number: number },
  quoteNumberStart: number,
  /** `YYYY-MM-DD`, as the form sends it; null when none was given. */
  validUntil: string | null,
  now: Date = new Date(),
): ReopenRefusal | null {
  if (quote.status !== QuoteStatus.EXPIRED) return "not-expired";
  if (!isNativeQuote(quote.number, quoteNumberStart)) return "imported";
  if (!validUntil || !/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || Number.isNaN(Date.parse(validUntil))) return "date-required";
  if (new Date(validUntil).getTime() <= now.getTime()) return "date-past";
  return null;
}

/** Whether the button is worth showing at all, before any date is picked. */
export function canReopen(quote: { status: QuoteStatus; number: number }, quoteNumberStart: number): boolean {
  return quote.status === QuoteStatus.EXPIRED && isNativeQuote(quote.number, quoteNumberStart);
}
