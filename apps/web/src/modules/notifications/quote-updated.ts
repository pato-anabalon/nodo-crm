import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { languageToLocale } from "@/i18n/config";
import { companyUrl } from "@/lib/tenant/host";
import { formatDate, formatMoney, formatQuoteNumber } from "@/lib/format";
import { MembershipStatus, NotificationKind, QuoteEventType, RoleKey } from "@/generated/prisma/enums";
import { describeChange, storedChanges, type ChangeFormat } from "@/modules/quotes/changes-text";
import { notify } from "./inbox";
import { sendNotice } from "./service";

/** Saves closer together than this are one round of editing, and one notice. */
export const QUOTE_UPDATE_BURST_MS = 30 * 60_000;

/**
 * Somebody changed a quote the customer has already opened.
 *
 * To the company's Owners and Admins and whoever owns the quote — the people
 * who would want to know a figure moved under a customer who has seen it —
 * but never to whoever made the change. The email lists what changed, worded
 * for each reader; the customer is told only that it was updated.
 *
 * A quote nobody opened is nothing to tell anyone about: the customer will
 * simply see the current version. And a run of saves is one round of editing,
 * so a save within `QUOTE_UPDATE_BURST_MS` of the one before raises nothing —
 * the history has each of them.
 */
export async function notifyQuoteUpdated(eventId: string): Promise<void> {
  const event = await prisma.quoteEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      type: true,
      userId: true,
      userName: true,
      changes: true,
      createdAt: true,
      quote: {
        select: {
          id: true,
          number: true,
          title: true,
          currency: true,
          companyId: true,
          createdById: true,
          share: { select: { openCount: true } },
          company: { select: { name: true, slug: true, quotePrefix: true, formatLocale: true, defaultLanguage: true } },
        },
      },
    },
  });
  if (!event || event.type !== QuoteEventType.UPDATED) return;
  const { quote } = event;
  if (!quote.share || quote.share.openCount === 0) return;

  const before = await prisma.quoteEvent.findFirst({
    where: {
      quoteId: quote.id,
      type: QuoteEventType.UPDATED,
      id: { not: event.id },
      createdAt: { gte: new Date(event.createdAt.getTime() - QUOTE_UPDATE_BURST_MS), lte: event.createdAt },
    },
    select: { id: true },
  });
  if (before) return;

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
  const name = event.userName ?? "";
  const path = `/quotes/${quote.id}?tab=activity`;

  const raised: string[] = [];
  for (const userId of new Set(members.map((member) => member.userId))) {
    if (userId === event.userId) continue;
    const fresh = await notify({
      companyId: quote.companyId,
      userId,
      kind: NotificationKind.QUOTE_UPDATED,
      params: { reference, name },
      href: path,
      dedupeKey: `quote-updated:${event.id}`,
    });
    if (fresh) raised.push(userId);
  }
  if (raised.length === 0) return;

  const changes = storedChanges(event.changes);
  const format: ChangeFormat = {
    money: (amount) => formatMoney(amount, quote.currency, company.formatLocale),
    date: (day) => formatDate(new Date(`${day}T00:00:00Z`), company.formatLocale, "UTC"),
  };
  const users = await prisma.user.findMany({ where: { id: { in: raised } }, select: { email: true, name: true, language: true } });

  for (const user of users) {
    try {
      const language = user.language ?? company.defaultLanguage;
      const locale = languageToLocale(language);
      const t = await getTranslations({ locale, namespace: "notifications" });
      const tQuotes = await getTranslations({ locale, namespace: "quotes" });
      const words = (key: string, values?: Record<string, string | number>) => tQuotes(key as never, values as never);
      await sendNotice({
        to: { email: user.email, name: user.name, language },
        companyName: company.name,
        subject: t("quoteUpdated.subject", { reference }),
        heading: t("quoteUpdated.heading", { name }),
        lines: [t("quoteUpdated.line", { reference, title: quote.title }), ...changes.map((change) => describeChange(change, words, format))],
        actionLabel: t("open"),
        actionUrl: companyUrl(company.slug, path),
        footer: { label: t("manage"), url: companyUrl(company.slug, "/settings/notifications") },
      });
    } catch (error) {
      // One address failing is no reason for the next person to hear nothing.
      console.error("[notice-email]", "quoteUpdated", error);
    }
  }
}
