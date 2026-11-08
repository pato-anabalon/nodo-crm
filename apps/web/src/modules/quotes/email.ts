import { getTranslations } from "next-intl/server";
import type { CompanyContext } from "@/lib/auth/session";
import { defaultFrom, getResend } from "@/lib/email/resend";
import { formatDate, formatMoney, formatQuoteNumber } from "@/lib/format";
import { languageToLocale } from "@/i18n/config";
import { EmailTemplateKind, PricingMode } from "@/generated/prisma/enums";
import { sanitizeRichText } from "@/lib/rich-text";
import { issueShare } from "@/modules/portal/service";
import { shareUrl } from "@/modules/portal/share";
import { companyUrl, ROOT_DOMAIN } from "@/lib/tenant/host";
import { renderCustomerEmail, renderCustomerEmailText } from "@/modules/email-templates/customer-email";
import { renderTemplate } from "@/modules/email-templates/render";
import { senderName } from "@/modules/email-templates/sender";
import { logCustomerEmail } from "@/modules/email-templates/customer-send";
import { templateFor } from "@/modules/email-templates/service";
import { renderQuoteEmail } from "./email-template";
import { joinNames } from "./recipients";
import { ensurePrimaryRecipient } from "./recipients-service";
import { getQuote } from "./service";

export type QuoteDelivery =
  | { sent: true; to: string; failed: string[] }
  | { sent: false; reason: string };

/**
 * Sends the quote.
 *
 * **Two emails go out, to two audiences.** The customer gets a notice — the
 * company's own words, a button, and nothing priced. The company gets the
 * detailed version that used to go to the customer, as the record of what was
 * sent.
 *
 * Only the customer's send decides the result: the internal copy failing is
 * worth a log line, not a red banner over an email the customer already has.
 *
 * Both go in the **quote's** language, not that of the user sending it: a rep
 * working in Spanish quotes in English to a customer in Auckland.
 */
export async function sendQuoteEmail(ctx: CompanyContext, quoteId: string): Promise<QuoteDelivery> {
  const t = await getTranslations("quotes");
  const quote = await getQuote(ctx, quoteId);
  if (!quote) return { sent: false, reason: t("notFound") };

  const recipients = await ensurePrimaryRecipient(ctx.company.id, quote.id, quote.lead);
  if (recipients.length === 0) return { sent: false, reason: t("email.noContactEmail") };

  const resend = getResend();
  if (!resend) return { sent: false, reason: t("email.notConfigured") };

  const reference = formatQuoteNumber(ctx.company.quotePrefix, quote.number);
  const money = (value: number) =>
    formatMoney(value, quote.currency, ctx.company.formatLocale);

  // The text the customer will read comes from the quote's language.
  const locale = languageToLocale(quote.language);
  const tEmail = await getTranslations({ locale, namespace: "quotes.email" });

  const validUntil = quote.validUntil
    ? formatDate(quote.validUntil, ctx.company.formatLocale, ctx.company.timezone)
    : null;

  const from = defaultFrom(
    senderName(ctx.company.senderNameStyle, {
      companyName: ctx.company.name,
      userName: ctx.user.name,
      connector: tEmail("senderConnector"),
    }),
  );

  // Everybody is greeted in every email, each sent to one address: the
  // greeting tells each person who else has the quote in front of them.
  const customer = joinNames(
    recipients.map((recipient) => recipient.name),
    locale,
  );

  const stored = await templateFor(ctx, EmailTemplateKind.NEW_QUOTE);
  const { subject, bodyHtml } = renderTemplate({
    stored,
    fallback: {
      subject: tEmail("defaultSubject"),
      body: tEmail("defaultBody", { customer }),
    },
    values: {
      customer,
      reference,
      company: ctx.company.name,
      author: quote.createdBy?.name ?? "",
    },
    reference,
  });

  const delivered: typeof recipients = [];
  const failed: string[] = [];
  let lastError: string | null = null;

  for (const recipient of recipients) {
    // Each recipient's own link, minted per send: the stored hash can't be
    // turned back into the old token, and the token is how the portal knows
    // which of them is reading.
    const share = await issueShare({
      companyId: ctx.company.id,
      quoteId: quote.id,
      expiresAt: quote.validUntil,
      recipientId: recipient.id,
    });

    const email = {
      bodyHtml,
      primaryColor: ctx.company.primaryColor,
      companyName: ctx.company.name,
      logoUrl: ctx.company.logoUrl,
      slogan: ctx.company.slogan,
      validUntilLabel: validUntil ? tEmail("validUntil", { date: validUntil }) : null,
      cta: { label: tEmail("viewQuote"), url: shareUrl(ctx.company.slug, share.token, ROOT_DOMAIN) },
      footerHtml: ctx.company.quoteFooter ? sanitizeRichText(ctx.company.quoteFooter) : null,
    };

    const { error } = await resend.emails.send({
      from,
      // One address per email. A copy is not a Cc: each person gets the quote
      // as though it were only theirs, with a link that is only theirs.
      to: recipient.email,
      // Replies go to the company, or to whoever sent it, never to the
      // platform's own address.
      replyTo: ctx.company.email?.trim() || ctx.user.email || undefined,
      subject,
      html: renderCustomerEmail(email),
      text: renderCustomerEmailText(email),
    });

    if (error) {
      failed.push(recipient.email);
      lastError = error.message;
    } else {
      delivered.push(recipient);
    }
  }

  // Nobody received it: that is a failed send. Some did: it went, and the
  // ones it didn't reach are said beside the success rather than hidden.
  if (delivered.length === 0) {
    return { sent: false, reason: t("email.rejected", { message: lastError ?? "" }) };
  }

  const to = delivered.map((recipient) => recipient.email).join(", ");

  // Logged like the scheduled ones, so the quote's list of what went out
  // starts with the email that started it rather than with the first chase.
  await logCustomerEmail({
    companyId: ctx.company.id,
    quoteId: quote.id,
    kind: EmailTemplateKind.NEW_QUOTE,
    to,
  });

  await sendInternalCopy(ctx, {
    quote,
    reference,
    money,
    validUntil,
    from,
    customerNames: joinNames(
      delivered.map((recipient) => recipient.name),
      ctx.locale,
    ),
    customerEmails: to,
  });

  return { sent: true, to, failed };
}

/**
 * The priced copy, to the company itself.
 *
 * **It must not carry the customer's link.** The first person on the team to
 * press that button would count as an opening, show up as "the customer is
 * viewing it right now" and trigger the "your quote was opened" notice — the
 * company watching itself. It points at the preview route instead, which draws
 * the same document and writes nothing.
 */
async function sendInternalCopy(
  ctx: CompanyContext,
  input: {
    quote: NonNullable<Awaited<ReturnType<typeof getQuote>>>;
    reference: string;
    money: (value: number) => string;
    validUntil: string | null;
    from: string;
    /** Who it went to, as the team reads it. */
    customerNames: string;
    customerEmails: string;
  },
): Promise<void> {
  if (!ctx.company.sendQuoteCopy) return;

  // The company's address, or whoever pressed Send. The fallback is what makes
  // this work on the first day, before anybody has configured an address.
  const to = ctx.company.email?.trim() || ctx.user.email;
  if (!to) return;

  const resend = getResend();
  if (!resend) return;

  const { quote, reference, money, validUntil } = input;
  // This one is read by the team, so it follows the reader's language rather
  // than the quote's.
  const tEmail = await getTranslations({ locale: ctx.locale, namespace: "quotes.email" });

  const html = renderQuoteEmail({
    companyName: ctx.company.name,
    primaryColor: ctx.company.primaryColor,
    contactName: input.customerNames || null,
    reference,
    title: quote.title,
    total: money(Number(quote.total)),
    validUntil,
    lines:
      quote.pricingMode === PricingMode.SECTIONS
        ? []
        : quote.items.map((item) => ({
            description: item.description,
            quantity: String(Number(item.quantity)),
            total: money(Number(item.total)),
          })),
    sections:
      quote.pricingMode === PricingMode.SECTIONS
        ? quote.sections.map((section) => ({
            title: section.title,
            amount: money(Number(section.amount)),
            bodyHtml: section.body ? sanitizeRichText(section.body) : null,
          }))
        : [],
    notesHtml: quote.notes ? sanitizeRichText(quote.notes) : null,
    viewUrl: companyUrl(ctx.company.slug, `/quotes/${quote.id}/preview`),
    labels: {
      greeting: tEmail("copyGreeting", { customer: input.customerNames }),
      intro: tEmail("copyIntro", { customer: input.customerEmails }),
      itemsHeader: tEmail("itemsHeader"),
      quantityHeader: tEmail("quantityHeader"),
      totalHeader: tEmail("totalHeader"),
      total: tEmail("total", { amount: money(Number(quote.total)) }),
      validUntil: validUntil ? tEmail("validUntil", { date: validUntil }) : "",
      viewQuote: tEmail("copyViewQuote"),
    },
  });

  // Deliberately not surfaced: the customer already has their email, and a
  // failure here is a missing archive copy, not a failed send.
  await resend.emails.send({ from: input.from, to, subject: `${reference} · ${quote.title}`, html });
}
