import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { languageToLocale } from "@/i18n/config";
import { formatQuoteNumber } from "@/lib/format";
import {
  Language,
  MembershipStatus,
  NotificationKind,
  QuoteStatus,
} from "@/generated/prisma/enums";
import { notify } from "./inbox";
import { sendNotice } from "./service";
import { dueDedupeKey, isDue } from "./due";
import { dailyKey, formLooksBroken, isBrokenOutcome, isExpiring, EXPIRING_WITHIN_DAYS } from "./watch";
import { sweepScheduledEmails } from "@/modules/email-templates/sweep";

export type SweepResult = {
  companies: number;
  expiring: number;
  brokenForms: number;
  dueTasks: number;
  /** The customer-facing emails that go on a calendar rather than an action. */
  firstFollowUps: number;
  secondFollowUps: number;
  reviewRequests: number;
};

/**
 * The once-a-day look around.
 *
 * Everything here is something nobody would otherwise find out: a quote quietly
 * running out, a web form that has been refusing every enquiry since Tuesday, a
 * task whose date passed while its owner was away from the app.
 *
 * Runs on the root domain and walks every company, so it goes through `prisma`
 * with an explicit `companyId` — the same shape as the ingest path, and for the
 * same reason: there is no session to bound it.
 *
 * Every notice carries a day-stamped key, so running twice raises nothing twice
 * and a retry after a failure is free.
 */
export async function runDailySweep(now: Date = new Date()): Promise<SweepResult> {
  const companies = await prisma.company.findMany({
    // A suspended company gets no more chasing emails than it gets a login.
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      quotePrefix: true,
      defaultLanguage: true,
      firstFollowUpDays: true,
      secondFollowUpDays: true,
      reviewRequestDays: true,
    },
  });

  const result: SweepResult = {
    companies: companies.length,
    expiring: 0,
    brokenForms: 0,
    dueTasks: 0,
    firstFollowUps: 0,
    secondFollowUps: 0,
    reviewRequests: 0,
  };

  for (const company of companies) {
    result.expiring += await sweepExpiringQuotes(company, now);
    result.brokenForms += await sweepBrokenForm(company, now);
    result.dueTasks += await sweepDueTasks(company, now);

    // The three that go to the customer rather than to the team. They live in
    // the emails module because that is where their wording and their switches
    // are; the sweep is only the clock.
    const emails = await sweepScheduledEmails(company, now);
    result.firstFollowUps += emails.firstFollowUps;
    result.secondFollowUps += emails.secondFollowUps;
    result.reviewRequests += emails.reviewRequests;
  }

  return result;
}

type CompanyRow = {
  id: string;
  name: string;
  quotePrefix: string;
  defaultLanguage: Language;
};

async function sweepExpiringQuotes(company: CompanyRow, now: Date): Promise<number> {
  const horizon = new Date(now.getTime() + EXPIRING_WITHIN_DAYS * 86_400_000);

  const quotes = await prisma.quote.findMany({
    where: {
      companyId: company.id,
      status: QuoteStatus.SENT,
      validUntil: { not: null, lte: horizon },
    },
    select: { id: true, number: true, title: true, validUntil: true, createdById: true },
    take: 100,
  });

  let raised = 0;

  for (const quote of quotes) {
    if (!isExpiring(quote, now) || !quote.createdById) continue;

    const reference = formatQuoteNumber(company.quotePrefix, quote.number);
    const fresh = await notify({
      companyId: company.id,
      userId: quote.createdById,
      kind: NotificationKind.QUOTE_EXPIRING,
      params: { reference, title: quote.title },
      href: `/quotes/${quote.id}`,
      dedupeKey: dailyKey("quote-expiring", quote.id, now),
    });
    if (!fresh) continue;

    raised += 1;
    await mail(company, quote.createdById, "quoteExpiring", { reference, title: quote.title });
  }

  return raised;
}

async function sweepBrokenForm(company: CompanyRow, now: Date): Promise<number> {
  const since = new Date(now.getTime() - 86_400_000);

  const attempts = await prisma.ingestAttempt.findMany({
    where: { companyId: company.id, createdAt: { gte: since } },
    select: { outcome: true },
  });
  if (attempts.length === 0) return 0;

  const counts = {
    rejected: attempts.filter((attempt) => isBrokenOutcome(attempt.outcome)).length,
    accepted: attempts.filter((attempt) => attempt.outcome === "ACCEPTED").length,
  };
  if (!formLooksBroken(counts)) return 0;

  // Whoever can fix it: this is a settings problem, not a sales one.
  const admins = await prisma.membership.findMany({
    where: {
      companyId: company.id,
      status: MembershipStatus.ACTIVE,
      role: { permissions: { some: { permission: { key: "settings.update" } } } },
    },
    select: { userId: true },
    take: 10,
  });

  let raised = 0;
  for (const admin of admins) {
    const fresh = await notify({
      companyId: company.id,
      userId: admin.userId,
      kind: NotificationKind.INGEST_FAILING,
      params: { count: counts.rejected },
      href: "/settings/api",
      dedupeKey: dailyKey("ingest-failing", company.id, now),
    });
    if (!fresh) continue;

    raised += 1;
    await mail(company, admin.userId, "ingestFailing", { count: String(counts.rejected) });
  }

  return raised;
}

async function sweepDueTasks(company: CompanyRow, now: Date): Promise<number> {
  const tasks = await prisma.task.findMany({
    where: {
      companyId: company.id,
      completedAt: null,
      assigneeId: { not: null },
      dueAt: { not: null, lte: now },
    },
    select: { id: true, title: true, dueAt: true, completedAt: true, assigneeId: true },
    take: 200,
  });

  let raised = 0;

  for (const task of tasks) {
    if (!isDue(task, now) || !task.assigneeId) continue;

    const fresh = await notify({
      companyId: company.id,
      userId: task.assigneeId,
      kind: NotificationKind.TASK_DUE,
      params: { title: task.title },
      href: "/tasks",
      // The same key the in-app sync uses, so whoever opened the app first
      // doesn't get told twice.
      dedupeKey: dueDedupeKey(task.id, now),
    });
    if (!fresh) continue;

    raised += 1;
    await mail(company, task.assigneeId, "taskDue", { title: task.title });
  }

  return raised;
}

/** The matching email, in the recipient's own language. */
async function mail(
  company: CompanyRow,
  userId: string,
  key: "quoteExpiring" | "ingestFailing" | "taskDue",
  params: Record<string, string>,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, language: true },
  });
  if (!user) return;

  const language = user.language ?? company.defaultLanguage;
  const t = await getTranslations({
    locale: languageToLocale(language),
    namespace: "notifications",
  });

  await sendNotice({
    to: { email: user.email, name: user.name, language },
    companyName: company.name,
    subject: t(`${key}.subject`, params),
    heading: t(`${key}.heading`, params),
    lines: [t(`${key}.line`, params)],
  });
}
