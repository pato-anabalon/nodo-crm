import { prisma } from "@/lib/db/prisma";
import { formatDate, formatQuoteNumber } from "@/lib/format";
import { MembershipStatus, NotificationKind, RoleKey } from "@/generated/prisma/enums";
import { wallClock } from "@nodo/core/zoned-time";
import { sendNoticeEmails } from "./email-notice";
import { notify } from "./inbox";

/**
 * A customer came back to a quote that ran out.
 *
 * The link stays open after a quote expires precisely so this can happen: they
 * read it again, can't accept it, and somebody should ring them while they're
 * still thinking about it. It goes to the company's Owners and Admins — whoever
 * decides whether to quote again — and to whoever wrote the quote, in place of
 * the ordinary "opened" notice, so nobody hears about the same visit twice.
 *
 * Once a day per quote and person (`dedupeKey` on the company's own calendar),
 * the same brake the "opened" notice has: a customer going through it with
 * their partner opens it ten times. The email goes only where the bell was
 * actually raised, so it follows the same opt-out.
 */
export async function notifyExpiredQuoteOpened(
  quoteId: string,
  viewer?: string,
  now: Date = new Date(),
): Promise<void> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      number: true,
      title: true,
      companyId: true,
      createdById: true,
      validUntil: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      lead: { select: { contactName: true } },
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          quotePrefix: true,
          timezone: true,
          formatLocale: true,
          defaultLanguage: true,
        },
      },
    },
  });
  if (!quote) return;

  const members = await prisma.membership.findMany({
    where: {
      companyId: quote.companyId,
      status: MembershipStatus.ACTIVE,
      OR: [
        { role: { key: { in: [RoleKey.OWNER, RoleKey.ADMIN] } } },
        ...(quote.createdById ? [{ userId: quote.createdById }] : []),
      ],
    },
    select: { userId: true },
  });

  const { company } = quote;
  const reference = formatQuoteNumber(company.quotePrefix, quote.number);
  const customer = viewer || quote.clientName || quote.lead?.contactName || quote.clientEmail || "";
  const day = wallClock(now, company.timezone).day;

  const raised: string[] = [];
  for (const userId of new Set(members.map((member) => member.userId))) {
    const fresh = await notify({
      companyId: quote.companyId,
      userId,
      kind: NotificationKind.QUOTE_EXPIRED_OPENED,
      params: { reference, customer },
      href: `/quotes/${quote.id}`,
      dedupeKey: `quote-expired-opened:${quote.id}:${day}`,
    });
    if (fresh) raised.push(userId);
  }
  if (raised.length === 0) return;

  // ICU `select` needs a value for "nothing", and an empty string isn't one.
  const contact = [quote.clientEmail, quote.clientPhone].filter(Boolean).join(" · ") || "none";
  const date = quote.validUntil
    ? formatDate(quote.validUntil, company.formatLocale, company.timezone)
    : "none";

  await sendNoticeEmails(company, {
    userIds: raised,
    template: "quoteExpiredOpened",
    params: { reference, title: quote.title, customer, contact, date },
    path: `/quotes/${quote.id}`,
  });
}
