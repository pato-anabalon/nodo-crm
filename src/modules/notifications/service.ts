import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { defaultFrom, getResend } from "@/lib/email/resend";
import { escapeHtml } from "@/lib/html";
import { languageToLocale } from "@/i18n/config";
import { formatQuoteNumber } from "@/lib/format";
import { NotificationKind, QuoteEventType } from "@/generated/prisma/enums";
import { notifyEach } from "./inbox";
import { staffRecipients } from "./recipients";
import type { Mailbox } from "./recipients";
import { withoutStaff } from "./extra-recipients";
import { shouldNotifyOpen } from "./throttle";

/**
 * Internal notices to the team.
 *
 * They go in each person's own language, unlike what goes out to the customer,
 * which follows the quote's. They're never fired inside the transaction and
 * never block the response: callers use `after()`.
 */

export type MailInput = {
  to: Mailbox;
  companyName: string;
  subject: string;
  heading: string;
  lines: string[];
  actionLabel?: string;
  actionUrl?: string;
};

export async function sendNotice(input: MailInput): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const body = input.lines
    .map((line) => `<p style="margin:0 0 10px;font-size:14px">${escapeHtml(line)}</p>`)
    .join("");

  const action =
    input.actionUrl && input.actionLabel
      ? `<p style="margin:20px 0 0"><a href="${escapeHtml(input.actionUrl)}" style="font-size:14px">${escapeHtml(input.actionLabel)}</a></p>`
      : "";

  const { error } = await resend.emails.send({
    from: defaultFrom(input.companyName),
    to: input.to.email,
    subject: input.subject,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
  <h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(input.heading)}</h1>
  ${body}${action}
</div>`,
  });

  return !error;
}

export async function notifyLeadReceived(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          defaultLanguage: true,
          leadNotificationEmails: true,
        },
      },
      submission: { select: { name: true, email: true, phone: true, serviceType: true } },
    },
  });
  if (!lead) return;

  const team = await staffRecipients({
    companyId: lead.companyId,
    preferUserId: lead.ownerId,
    permission: "leads.read.all",
    kind: NotificationKind.LEAD_RECEIVED,
  });

  /**
   * The addresses the company added by hand, minus anyone the team already
   * covers. They have no account and so no language of their own, which is what
   * the company's default is for.
   */
  const extras = withoutStaff(
    lead.company.leadNotificationEmails,
    team.map((recipient) => recipient.email),
  ).map((email) => ({ email, name: null, language: lead.company.defaultLanguage }));

  // The bell gets it too, and only the team: the extra addresses are inboxes,
  // not accounts, so there is nobody to hang a notification on.
  await notifyEach(team.map((to) => to.id), {
    companyId: lead.company.id,
    kind: NotificationKind.LEAD_RECEIVED,
    params: { title: lead.title },
    href: `/leads/${lead.id}`,
  });

  for (const to of [...team, ...extras]) {
    const t = await getTranslations({
      locale: languageToLocale(to.language),
      namespace: "notifications",
    });

    await sendNotice({
      to,
      companyName: lead.company.name,
      subject: t("leadReceived.subject", { title: lead.title }),
      heading: t("leadReceived.heading"),
      lines: [
        lead.title,
        [lead.submission?.name, lead.submission?.email, lead.submission?.phone]
          .filter(Boolean)
          .join(" · ") || t("leadReceived.noContact"),
      ],
    });
  }
}

export async function notifyQuoteOpened(quoteId: string): Promise<void> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      company: { select: { id: true, name: true, quotePrefix: true } },
      lead: { select: { ownerId: true, contactName: true } },
    },
  });
  if (!quote) return;

  // Only the first notice of the day: the customer may open it ten times in a row.
  const opens = await prisma.quoteEvent.findMany({
    where: { quoteId, type: QuoteEventType.OPENED },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { createdAt: true },
  });
  // The event just recorded is already in the list, so it's dropped.
  if (!shouldNotifyOpen(opens.slice(1))) return;

  const recipients = await staffRecipients({
    companyId: quote.companyId,
    preferUserId: quote.createdById ?? quote.lead?.ownerId ?? null,
    permission: "quotes.read.all",
    kind: NotificationKind.QUOTE_OPENED,
  });

  const reference = formatQuoteNumber(quote.company.quotePrefix, quote.number);

  await notifyEach(recipients.map((to) => to.id), {
    companyId: quote.companyId,
    kind: NotificationKind.QUOTE_OPENED,
    params: { reference, customer: quote.lead?.contactName ?? "" },
    href: `/quotes/${quote.id}`,
  });

  for (const to of recipients) {
    const t = await getTranslations({
      locale: languageToLocale(to.language),
      namespace: "notifications",
    });

    await sendNotice({
      to,
      companyName: quote.company.name,
      subject: t("quoteOpened.subject", { reference }),
      heading: t("quoteOpened.heading", { client: quote.lead?.contactName ?? "" }),
      lines: [`${reference} · ${quote.title}`],
    });
  }
}

export async function notifyQuoteDecided(
  quoteId: string,
  decision: "accepted" | "declined",
): Promise<void> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      company: { select: { id: true, name: true, quotePrefix: true } },
      lead: { select: { ownerId: true, contactName: true } },
      acceptance: { select: { acceptedByName: true, orderReference: true } },
    },
  });
  if (!quote) return;

  const recipients = await staffRecipients({
    companyId: quote.companyId,
    preferUserId: quote.createdById ?? quote.lead?.ownerId ?? null,
    permission: "quotes.read.all",
    kind: NotificationKind.QUOTE_DECIDED,
  });

  const reference = formatQuoteNumber(quote.company.quotePrefix, quote.number);

  // `decision` travels as a neutral token, never as a word: the bell renders in
  // whatever language the reader works in, which may not be the sender's — and
  // may change after this row was written.
  await notifyEach(recipients.map((to) => to.id), {
    companyId: quote.companyId,
    kind: NotificationKind.QUOTE_DECIDED,
    params: { reference, decision },
    href: `/quotes/${quote.id}`,
  });

  for (const to of recipients) {
    const t = await getTranslations({
      locale: languageToLocale(to.language),
      namespace: "notifications",
    });

    const lines = [`${reference} · ${quote.title}`];
    if (quote.acceptance?.acceptedByName) {
      lines.push(t("quoteDecided.by", { name: quote.acceptance.acceptedByName }));
    }
    if (quote.acceptance?.orderReference) {
      lines.push(t("quoteDecided.reference", { reference: quote.acceptance.orderReference }));
    }

    await sendNotice({
      to,
      companyName: quote.company.name,
      subject: t(`quoteDecided.subject_${decision}`, { reference }),
      heading: t(`quoteDecided.heading_${decision}`),
      lines,
    });
  }
}

export async function notifyClientMessage(quoteId: string, preview: string): Promise<void> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      company: { select: { id: true, name: true, quotePrefix: true } },
      lead: { select: { ownerId: true, contactName: true } },
    },
  });
  if (!quote) return;

  const recipients = await staffRecipients({
    companyId: quote.companyId,
    preferUserId: quote.createdById ?? quote.lead?.ownerId ?? null,
    permission: "quotes.read.all",
    kind: NotificationKind.CLIENT_MESSAGE,
  });

  const reference = formatQuoteNumber(quote.company.quotePrefix, quote.number);

  await notifyEach(recipients.map((to) => to.id), {
    companyId: quote.companyId,
    kind: NotificationKind.CLIENT_MESSAGE,
    params: { reference, customer: quote.lead?.contactName ?? "" },
    href: `/quotes/${quote.id}`,
  });

  for (const to of recipients) {
    const t = await getTranslations({
      locale: languageToLocale(to.language),
      namespace: "notifications",
    });

    await sendNotice({
      to,
      companyName: quote.company.name,
      subject: t("clientMessage.subject", { reference }),
      heading: t("clientMessage.heading", { client: quote.lead?.contactName ?? "" }),
      lines: [preview.slice(0, 300)],
    });
  }
}
