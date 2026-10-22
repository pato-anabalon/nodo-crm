import { ActivityType, QuoteStatus, type LeadStatus } from "@/generated/prisma/enums";
import { nextLeadStatus, type LeadEvent } from "@/modules/leads/constants";

/**
 * Either `ctx.db` or `prisma`, described by the four calls this makes. Naming
 * the real client type doesn't work: the tenant-extended one isn't assignable
 * to the plain one, and a union of the two can't be called.
 */
type Db = {
  quote: { count(args: { where: { leadId: string; status: { in: QuoteStatus[] } } }): Promise<number> };
  lead: {
    findFirst(args: {
      where: { id: string; companyId: string };
      select: { status: true };
    }): Promise<{ status: LeadStatus } | null>;
    update(args: { where: { id: string }; data: { status: LeadStatus } }): Promise<unknown>;
  };
  activity: {
    create(args: {
      data: {
        companyId: string;
        leadId: string;
        userId: string | null;
        type: ActivityType;
        content: string;
      };
    }): Promise<unknown>;
  };
};

/**
 * Moves the lead a quote belongs to, when the quote's fate says something about
 * the work as a whole. The one place that decides it, for every way a quote can
 * change status: the team (`changeQuoteStatus`), the customer in the portal, and
 * the nightly sweep that expires what nobody answered. Each used to carry its own
 * copy, and the portal simply had none, which is how an accepted quote left its
 * lead sitting in `PROPOSAL`.
 *
 * A single declined quote isn't a lost lead: a job can be quoted twice, and the
 * second one may still be live. Only when nothing is left open does the work
 * count as lost.
 *
 * `userId` is the person behind the change, or null when nobody is: the customer
 * pressing accept in the portal, or the clock. The caller passes the db it has
 * (`ctx.db` with a session, `prisma` with an explicit `companyId` without one).
 */
export async function moveLeadAlong(
  db: Db,
  input: { companyId: string; leadId: string; to: QuoteStatus; userId: string | null },
) {
  const { companyId, leadId, to, userId } = input;
  let event: LeadEvent | null = null;

  if (to === QuoteStatus.SENT) event = "quote-sent";
  else if (to === QuoteStatus.ACCEPTED) event = "quote-accepted";
  else if (to === QuoteStatus.REJECTED || to === QuoteStatus.EXPIRED) {
    const stillOpen = await db.quote.count({
      where: { leadId, status: { in: [QuoteStatus.DRAFT, QuoteStatus.SENT] } },
    });
    if (stillOpen === 0) event = "quotes-all-declined";
  }

  if (!event) return;

  const lead = await db.lead.findFirst({ where: { id: leadId, companyId }, select: { status: true } });
  if (!lead) return;

  const next = nextLeadStatus(lead.status, event);
  if (!next) return;

  await db.lead.update({ where: { id: leadId }, data: { status: next } });

  // Recorded like any other move on the lead, so its history shows who and when
  // even though the "who" here is the quote rather than a person.
  await db.activity.create({
    data: {
      companyId,
      leadId,
      userId,
      type: ActivityType.STATUS_CHANGE,
      // The same separator the lead's own service writes, because the same
      // line reads both. An arrow here is how `leads.status.NEW → PROPOSAL`
      // ended up being asked for.
      content: `${lead.status}>${next}`,
    },
  });
}
