import { prisma } from "@/lib/db/prisma";
import { EmailTemplateKind, MessageAuthor, QuoteStatus } from "@/generated/prisma/enums";
import { sendToCustomer } from "./customer-send";
import { shouldAskForReview, shouldFollowUp, type ScheduledQuote } from "./schedule";

export type ScheduledEmailResult = {
  firstFollowUps: number;
  secondFollowUps: number;
  reviewRequests: number;
};

/**
 * The three emails that go out on a calendar rather than on an action.
 *
 * Part of the nightly sweep, which is what makes them possible at all: nobody is
 * going to remember to chase a quote on its third day. The company decides the
 * three waits; whether they happen at all is each template's own switch, and
 * those start **off** — the first night after this shipped would otherwise look
 * at every quote already sitting out there undecided and chase them all at once,
 * by nobody's decision.
 *
 * Idempotent through `QuoteEmail`: a row per quote and kind, with a unique key,
 * so a retry after a failure is free and running twice sends nothing twice.
 */
export async function sweepScheduledEmails(
  company: { id: string; firstFollowUpDays: number; secondFollowUpDays: number; reviewRequestDays: number },
  now: Date,
): Promise<ScheduledEmailResult> {
  const result: ScheduledEmailResult = {
    firstFollowUps: 0,
    secondFollowUps: 0,
    reviewRequests: 0,
  };

  const quotes = await prisma.quote.findMany({
    where: {
      companyId: company.id,
      status: { in: [QuoteStatus.SENT, QuoteStatus.ACCEPTED] },
      clientEmail: { not: null },
    },
    select: {
      id: true,
      status: true,
      sentAt: true,
      decidedAt: true,
      validUntil: true,
      share: { select: { revokedAt: true } },
      emailsSent: { select: { kind: true } },
      // One row is enough to know somebody replied; the content is not needed.
      messages: { where: { author: MessageAuthor.CLIENT }, select: { id: true }, take: 1 },
    },
    take: 500,
  });

  for (const quote of quotes) {
    const sent = new Set(quote.emailsSent.map((row) => row.kind));
    const base: Omit<ScheduledQuote, "alreadySent"> = {
      status: quote.status,
      sentAt: quote.sentAt,
      decidedAt: quote.decidedAt,
      validUntil: quote.validUntil,
      shareRevokedAt: quote.share?.revokedAt ?? null,
      customerHasWritten: quote.messages.length > 0,
    };

    const due: Array<[EmailTemplateKind, boolean, keyof ScheduledEmailResult]> = [
      [
        EmailTemplateKind.FIRST_FOLLOW_UP,
        shouldFollowUp(
          { ...base, alreadySent: sent.has(EmailTemplateKind.FIRST_FOLLOW_UP) },
          company.firstFollowUpDays,
          now,
        ),
        "firstFollowUps",
      ],
      [
        EmailTemplateKind.SECOND_FOLLOW_UP,
        shouldFollowUp(
          { ...base, alreadySent: sent.has(EmailTemplateKind.SECOND_FOLLOW_UP) },
          company.secondFollowUpDays,
          now,
        ),
        "secondFollowUps",
      ],
      [
        EmailTemplateKind.REVIEW_REQUEST,
        shouldAskForReview(
          { ...base, alreadySent: sent.has(EmailTemplateKind.REVIEW_REQUEST) },
          company.reviewRequestDays,
          now,
        ),
        "reviewRequests",
      ],
    ];

    for (const [kind, ready, counter] of due) {
      // `sendToCustomer` reports whether it actually sent — a template switched
      // off, or no review links — so the count is emails, not candidates.
      if (ready && (await sendToCustomer(quote.id, kind))) result[counter] += 1;
    }
  }

  return result;
}
