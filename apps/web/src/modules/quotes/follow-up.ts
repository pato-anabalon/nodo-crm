import { EmailTemplateKind, QuoteStatus } from "@/generated/prisma/enums";
import { quoteRanOut } from "@/modules/portal/share";

export type ManualFollowUp =
  | typeof EmailTemplateKind.FIRST_FOLLOW_UP
  | typeof EmailTemplateKind.SECOND_FOLLOW_UP;

/**
 * Which follow-up a person may send by hand now, or none.
 *
 * In order — the second only once the first went, whoever sent it — and only
 * while the quote is waiting for an answer through a link that opens. A
 * follow-up issues a new link, and issuing reopens a closed one: sending one
 * after the link was revoked would quietly undo the revoke. The nightly sweep
 * reads the same `QuoteEmail` rows, so one sent by hand is never sent again
 * on its own.
 */
export function nextFollowUp(
  quote: {
    status: QuoteStatus;
    validUntil: Date | null;
    share: { revokedAt: Date | null } | null;
    emailsSent: Array<{ kind: EmailTemplateKind }>;
  },
  now: Date = new Date(),
): ManualFollowUp | null {
  if (quote.status !== QuoteStatus.SENT || quoteRanOut(quote, now)) return null;
  if (!quote.share || quote.share.revokedAt) return null;

  const sent = new Set(quote.emailsSent.map((email) => email.kind));
  if (!sent.has(EmailTemplateKind.FIRST_FOLLOW_UP)) return EmailTemplateKind.FIRST_FOLLOW_UP;
  if (!sent.has(EmailTemplateKind.SECOND_FOLLOW_UP)) return EmailTemplateKind.SECOND_FOLLOW_UP;
  return null;
}
