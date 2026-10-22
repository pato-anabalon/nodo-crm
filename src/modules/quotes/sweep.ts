import { prisma } from "@/lib/db/prisma";
import { ActivityType, QuoteStatus } from "@/generated/prisma/enums";
import { hasExpired } from "@/modules/notifications/watch";
import { moveLeadAlong } from "./lead-sync";
import { nativeQuoteWhere } from "./native";

/**
 * Closes out quotes nobody answered before their `validUntil` ran out.
 *
 * Nothing else in the app ever does this: `validUntil` passing only raises
 * `QUOTE_EXPIRING`, a warning a few days ahead of it, and a company's own
 * screens have no "mark expired" action either — `EXPIRED` was reachable only
 * from the Quotient import, which brought it in as a fact already settled in
 * Quotient's own history. A quote created here and ignored stayed `SENT`
 * forever, which is exactly what made Reports' `awaiting` figure an
 * accumulator before this and `expired` existed (see `reports/stock-flow.ts`).
 *
 * Idempotent through the `status: SENT` filter itself: once a quote is moved
 * to `EXPIRED` it no longer matches, so a retry after a failure costs nothing
 * and running twice in one night closes nothing twice.
 */
export async function closeExpiredQuotes(
  company: { id: string; quoteNumberStart: number },
  now: Date,
): Promise<number> {
  const quotes = await prisma.quote.findMany({
    // Only quotes made here. One brought in from another tool and still `SENT`
    // past its date is that tool's to close; doing it here would also move its
    // lead along on a history this platform never recorded.
    where: {
      companyId: company.id,
      ...nativeQuoteWhere(company.quoteNumberStart),
      status: QuoteStatus.SENT,
      validUntil: { not: null, lt: now },
    },
    select: { id: true, number: true, leadId: true, validUntil: true },
    take: 500,
  });

  let closed = 0;

  for (const quote of quotes) {
    // The SQL filter above already narrows to this; `hasExpired` is the one
    // tested, authoritative word on what "expired" means, the same role
    // `isExpiring` plays for the warning sweep next to this one.
    if (!hasExpired(quote, now)) continue;

    await prisma.quote.update({ where: { id: quote.id }, data: { status: QuoteStatus.EXPIRED } });
    closed += 1;

    // A quote this old should always have a lead — `changeQuoteStatus` refuses
    // to send one without — but a stray row from before that rule, or bad
    // data, shouldn't stop the rest of the sweep over one missing activity
    // trail.
    if (!quote.leadId) continue;

    // The line goes through `prisma` with an explicit `companyId`, and the lead
    // through the shared `moveLeadAlong`: there's no session to bound a cron,
    // so no `ctx.db` and no signed-in actor.
    await prisma.activity.create({
      data: {
        companyId: company.id,
        leadId: quote.leadId,
        userId: null, // nobody decided this — the clock did
        type: ActivityType.QUOTE_DECIDED,
        content: `${quote.number}>${QuoteStatus.EXPIRED}`,
      },
    });

    await moveLeadAlong(prisma, { companyId: company.id, leadId: quote.leadId, to: QuoteStatus.EXPIRED, userId: null });
  }

  return closed;
}
