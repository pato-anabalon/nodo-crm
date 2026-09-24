import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { defaultFrom, getResend } from "@/lib/email/resend";
import { formatQuoteNumber } from "@/lib/format";
import { languageToLocale } from "@/i18n/config";
import { EmailTemplateKind } from "@/generated/prisma/enums";
import { sanitizeRichText } from "@/lib/rich-text";
import { issueShare } from "@/modules/portal/service";
import { shareUrl } from "@/modules/portal/share";
import { ROOT_DOMAIN } from "@/lib/tenant/host";
import { renderCustomerEmail } from "./customer-email";
import { isEnabled } from "./kinds";
import { renderTemplate } from "./render";
import { senderName } from "./sender";

/** The ones a scheduler sends, plus the confirmation an acceptance triggers. */
const FALLBACK_KEYS: Record<string, { subject: string; body: string }> = {
  [EmailTemplateKind.QUOTE_ACCEPTED]: { subject: "acceptedSubject", body: "acceptedBody" },
  [EmailTemplateKind.FIRST_FOLLOW_UP]: { subject: "followUpSubject", body: "followUpBody" },
  [EmailTemplateKind.SECOND_FOLLOW_UP]: { subject: "followUpSubject", body: "followUpBody" },
  [EmailTemplateKind.REVIEW_REQUEST]: { subject: "reviewSubject", body: "reviewBody" },
};

/** Which of them need a way back to the quote. */
const NEEDS_LINK = new Set<string>([
  EmailTemplateKind.FIRST_FOLLOW_UP,
  EmailTemplateKind.SECOND_FOLLOW_UP,
]);

/**
 * Sends one of the customer-facing emails and records that it went.
 *
 * Runs with no session — a scheduler sends most of these — so it goes through
 * `prisma` with an explicit `companyId`, the same shape as the ingest and cron
 * paths and for the same reason.
 *
 * Returns whether it actually sent, which is what lets the sweep report a real
 * count rather than the number of quotes it looked at.
 */
export async function sendToCustomer(
  quoteId: string,
  kind: EmailTemplateKind,
): Promise<boolean> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      number: true,
      language: true,
      validUntil: true,
      clientEmail: true,
      clientName: true,
      companyId: true,
      createdBy: { select: { name: true } },
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          primaryColor: true,
          logoUrl: true,
          quotePrefix: true,
          quoteFooter: true,
          slogan: true,
          senderNameStyle: true,
          reviewLinks: { orderBy: { position: "asc" }, select: { source: true, url: true } },
        },
      },
    },
  });

  // The address frozen on the quote, not the lead's current one: if the contact
  // changed email since it went out, this belongs to whoever was written to.
  const to = quote?.clientEmail?.trim();
  if (!quote || !to) return false;

  const stored = await prisma.emailTemplate.findUnique({
    where: { companyId_kind: { companyId: quote.companyId, kind } },
    select: { subject: true, bodyHtml: true, enabled: true },
  });
  if (!isEnabled(kind, stored)) return false;

  // Asking for a review with nowhere to leave one is an email that wastes
  // somebody's goodwill, which is the one thing it was sent to collect.
  if (kind === EmailTemplateKind.REVIEW_REQUEST && quote.company.reviewLinks.length === 0) {
    return false;
  }

  const resend = getResend();
  if (!resend) return false;

  const locale = languageToLocale(quote.language);
  const tEmail = await getTranslations({ locale, namespace: "quotes.email" });
  const reference = formatQuoteNumber(quote.company.quotePrefix, quote.number);
  const keys = FALLBACK_KEYS[kind];
  if (!keys) return false;

  const { subject, bodyHtml } = renderTemplate({
    stored,
    fallback: {
      subject: tEmail(keys.subject),
      body: tEmail(keys.body, { customer: quote.clientName ?? "" }),
    },
    values: { customer: quote.clientName ?? "", reference, company: quote.company.name },
    reference,
  });

  /*
   * A follow-up mints a fresh link, which kills the one the first email carried.
   *
   * There is no way around it: only the hash is stored, so an issued token can
   * never be read back. It is the same property a resend already has, and this
   * way the customer's most recent email is always the one that works — which is
   * the one they will click. A follow-up with no way to see the quote would be
   * an email asking somebody to look at something it doesn't show them.
   */
  const cta = NEEDS_LINK.has(kind)
    ? {
        label: tEmail("viewQuote"),
        url: shareUrl(
          quote.company.slug,
          (
            await issueShare({
              companyId: quote.companyId,
              quoteId: quote.id,
              expiresAt: quote.validUntil,
            })
          ).token,
          ROOT_DOMAIN,
        ),
      }
    : null;

  const { error } = await resend.emails.send({
    from: defaultFrom(
      senderName(quote.company.senderNameStyle, {
        companyName: quote.company.name,
        userName: quote.createdBy?.name,
        connector: tEmail("senderConnector"),
      }),
    ),
    to,
    subject,
    html: renderCustomerEmail({
      bodyHtml: withReviewLinks(bodyHtml, kind, quote.company.reviewLinks),
      primaryColor: quote.company.primaryColor,
      companyName: quote.company.name,
      logoUrl: quote.company.logoUrl,
      slogan: quote.company.slogan,
      validUntilLabel: null,
      cta,
      footerHtml: quote.company.quoteFooter ? sanitizeRichText(quote.company.quoteFooter) : null,
    }),
  });
  if (error) return false;

  await logCustomerEmail({ companyId: quote.companyId, quoteId: quote.id, kind, to });
  return true;
}

/**
 * Records that one of these went out.
 *
 * Two jobs at once. It keeps the nightly sweep from chasing the same customer
 * every night — the unique key on (quote, kind) is what makes a second attempt
 * impossible rather than unlikely — and it is what the quote's "emails sent"
 * list reads, which answers a question nobody could answer before: has this
 * customer already been followed up, and when.
 *
 * The update path only matters for the quote itself, which can be resent; the
 * scheduled ones never reach it because they check the row before sending.
 */
export async function logCustomerEmail(input: {
  companyId: string;
  quoteId: string;
  kind: EmailTemplateKind;
  to: string;
}): Promise<void> {
  await prisma.quoteEmail.upsert({
    where: { quoteId_kind: { quoteId: input.quoteId, kind: input.kind } },
    create: input,
    update: { sentAt: new Date(), to: input.to },
  });
}

/**
 * The review links, appended as a list.
 *
 * Not offered as a field the company writes into their text: the whole email
 * exists to hand these over, and one left out by a typo is an email that asks
 * for a favour and then doesn't say where.
 */
function withReviewLinks(
  bodyHtml: string,
  kind: EmailTemplateKind,
  links: Array<{ source: string; url: string }>,
): string {
  if (kind !== EmailTemplateKind.REVIEW_REQUEST || links.length === 0) return bodyHtml;

  const items = links
    .map(
      (link) =>
        `<li style="margin:4px 0"><a href="${escapeAttribute(link.url)}">${labelFor(link.source)}</a></li>`,
    )
    .join("");

  return `${bodyHtml}<ul style="padding-left:18px;margin:12px 0">${items}</ul>`;
}

/** Platform names are proper nouns, so they are not translated. */
function labelFor(source: string): string {
  return { GOOGLE: "Google", NOCOWBOYS: "NoCowboys", FACEBOOK: "Facebook" }[source] ?? "Web";
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
