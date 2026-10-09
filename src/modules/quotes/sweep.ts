import { prisma } from "@/lib/db/prisma";
import { ActivityType, QuoteStatus } from "@/generated/prisma/enums";
import { nextLeadStatus } from "@/modules/leads/constants";
import { hasExpired } from "@/modules/notifications/watch";

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
  company: { id: string },
  now: Date,
): Promise<number> {
  const quotes = await prisma.quote.findMany({
    where: { companyId: company.id, status: QuoteStatus.SENT, validUntil: { not: null, lt: now } },
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

    // Same shape as `changeQuoteStatus`/`moveLeadAlong` in quotes/service.ts,
    // duplicated rather than shared: those take a `CompanyContext` and a
    // signed-in actor, neither of which exists here — there's no session to
    // bound a cron, the same reason the rest of this sweep goes through
    // `prisma` with an explicit `companyId` instead of `ctx.db`.
    await prisma.activity.create({
      data: {
        companyId: company.id,
        leadId: quote.leadId,
        userId: null, // nobody decided this — the clock did
        type: ActivityType.QUOTE_DECIDED,
        content: `${quote.number}>${QuoteStatus.EXPIRED}`,
      },
    });

    const stillOpen = await prisma.quote.count({
      where: { leadId: quote.leadId, status: { in: [QuoteStatus.DRAFT, QuoteStatus.SENT] } },
    });
    if (stillOpen > 0) continue;

    const lead = await prisma.lead.findFirst({ where: { id: quote.leadId }, select: { status: true } });
    if (!lead) continue;

    const next = nextLeadStatus(lead.status, "quotes-all-declined");
    if (!next) continue;

    await prisma.lead.update({ where: { id: quote.leadId }, data: { status: next } });
    await prisma.activity.create({
      data: {
        companyId: company.id,
        leadId: quote.leadId,
        userId: null,
        type: ActivityType.STATUS_CHANGE,
        content: `${lead.status}>${next}`,
      },
    });
  }

  return closed;
}
