/**
 * Counts what the nightly sweep would act on, without acting on anything.
 *
 * Written before the sweep was allowed to run against a company that came over
 * from another tool: those companies have thousands of old quotes still being
 * managed there, and the sweep can't tell them from quotes made here. This shows,
 * per company, how many of each would be touched tonight, split by whether the
 * quote's number is below `Company.quoteNumberStart` (brought in) or at/above it
 * (made here) — the line the sweep is meant to be held to.
 *
 * It asks the very same questions the sweep does (`shouldFollowUp`,
 * `shouldAskForReview`, `isExpiring`, `hasExpired`, `isEnabled`, `leaveLinks`),
 * so the numbers are what the sweep would decide, not an approximation.
 *
 * **Read-only.** It only reads; nothing is written, sent or queued. Safe against
 * production.
 *
 * Usage:
 *   npx tsx scripts/count-cron-candidates.ts --slug=plasterprosolution
 *   npx tsx scripts/count-cron-candidates.ts --all
 *
 * Against production, point DATABASE_URL at it for the one command:
 *   DATABASE_URL="postgres://…" npx tsx scripts/count-cron-candidates.ts --slug=…
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { EmailTemplateKind, MessageAuthor, QuoteStatus } from "../src/generated/prisma/enums";
import { isEnabled } from "../src/modules/email-templates/kinds";
import { shouldAskForReview, shouldFollowUp } from "../src/modules/email-templates/schedule";
import { hasExpired, isExpiring } from "../src/modules/notifications/watch";
import { leaveLinks } from "../src/modules/settings/review-platforms";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (match) out[match[1]] = match[2] ?? "true";
  }
  return out;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL }),
});

/** Brought in (below the start) against made here (at or above it). */
type Split = { migrated: number; native: number };
const split = (): Split => ({ migrated: 0, native: 0 });

function row(label: string, counts: Split, note = ""): void {
  const total = counts.migrated + counts.native;
  console.log(
    `  ${label.padEnd(34)} ${String(total).padStart(6)}   migrated ${String(counts.migrated).padStart(6)}   native ${String(counts.native).padStart(6)}${note ? `   ${note}` : ""}`,
  );
}

async function countCompany(company: {
  id: string;
  slug: string;
  name: string;
  quoteNumberStart: number;
  firstFollowUpDays: number;
  secondFollowUpDays: number;
  reviewRequestDays: number;
}): Promise<void> {
  const now = new Date();
  const isMigrated = (number: number) => number < company.quoteNumberStart;

  const [quotes, templates, reviewLinks] = await Promise.all([
    prisma.quote.findMany({
      where: { companyId: company.id },
      select: {
        id: true,
        number: true,
        status: true,
        sentAt: true,
        decidedAt: true,
        validUntil: true,
        clientEmail: true,
        createdById: true,
        legacyQuotientNumber: true,
        title: true,
        createdAt: true,
        share: { select: { revokedAt: true } },
        emailsSent: { select: { kind: true } },
        messages: { where: { author: MessageAuthor.CLIENT }, select: { id: true }, take: 1 },
      },
    }),
    prisma.emailTemplate.findMany({ where: { companyId: company.id }, select: { kind: true, enabled: true } }),
    prisma.reviewLink.findMany({
      where: { companyId: company.id },
      select: { source: true, label: true, readUrl: true, leaveUrl: true },
    }),
  ]);

  const stored = (kind: EmailTemplateKind) => templates.find((template) => template.kind === kind) ?? null;
  const on = {
    first: isEnabled(EmailTemplateKind.FIRST_FOLLOW_UP, stored(EmailTemplateKind.FIRST_FOLLOW_UP)),
    second: isEnabled(EmailTemplateKind.SECOND_FOLLOW_UP, stored(EmailTemplateKind.SECOND_FOLLOW_UP)),
    review: isEnabled(EmailTemplateKind.REVIEW_REQUEST, stored(EmailTemplateKind.REVIEW_REQUEST)),
  };
  const reviewPlaces = leaveLinks(reviewLinks).length;

  const byStatus = new Map<QuoteStatus, Split>();
  const first = split();
  const second = split();
  const review = split();
  const closing = split();
  const expiring = split();
  let importedAboveStart = 0;
  let madeHereBelowStart = 0;
  /** Quotes with no Quotient number that sit below the start: made here, before it was set. */
  const strays: typeof quotes = [];

  for (const quote of quotes) {
    const side = isMigrated(quote.number) ? "migrated" : "native";

    const status = byStatus.get(quote.status) ?? split();
    status[side] += 1;
    byStatus.set(quote.status, status);

    // The two ways the number and the origin can disagree, which would make the
    // rule misjudge a quote: worth seeing before relying on it.
    if (quote.legacyQuotientNumber !== null && !isMigrated(quote.number)) importedAboveStart += 1;
    if (quote.legacyQuotientNumber === null && isMigrated(quote.number)) {
      madeHereBelowStart += 1;
      strays.push(quote);
    }

    // What `closeExpiredQuotes` and `sweepExpiringQuotes` would look at.
    const closes = quote.status === QuoteStatus.SENT && hasExpired(quote, now);
    if (closes) closing[side] += 1;
    // `isExpiring` is also true of a quote already past its date, but the sweep
    // closes those first, so they never reach the warning.
    if (!closes && quote.status === QuoteStatus.SENT && quote.createdById && isExpiring(quote, now)) expiring[side] += 1;

    // What `sweepScheduledEmails` would look at: the same filter, then the same questions.
    if (!quote.clientEmail) continue;
    if (quote.status !== QuoteStatus.SENT && quote.status !== QuoteStatus.ACCEPTED) continue;

    const sent = new Set(quote.emailsSent.map((email) => email.kind));
    const base = {
      status: quote.status,
      sentAt: quote.sentAt,
      decidedAt: quote.decidedAt,
      validUntil: quote.validUntil,
      shareRevokedAt: quote.share?.revokedAt ?? null,
      customerHasWritten: quote.messages.length > 0,
    };

    if (shouldFollowUp({ ...base, alreadySent: sent.has(EmailTemplateKind.FIRST_FOLLOW_UP) }, company.firstFollowUpDays, now)) {
      first[side] += 1;
    }
    if (shouldFollowUp({ ...base, alreadySent: sent.has(EmailTemplateKind.SECOND_FOLLOW_UP) }, company.secondFollowUpDays, now)) {
      second[side] += 1;
    }
    if (shouldAskForReview({ ...base, alreadySent: sent.has(EmailTemplateKind.REVIEW_REQUEST) }, company.reviewRequestDays, now)) {
      review[side] += 1;
    }
  }

  console.log(`\n=== ${company.name} (${company.slug}) ===`);
  console.log(`quoteNumberStart: ${company.quoteNumberStart}   quotes: ${quotes.length}`);
  console.log(
    `  below the start: ${quotes.filter((quote) => isMigrated(quote.number)).length}   at or above it: ${quotes.filter((quote) => !isMigrated(quote.number)).length}`,
  );
  if (importedAboveStart > 0 || madeHereBelowStart > 0) {
    console.log(
      `  ⚠ origin and number disagree: ${importedAboveStart} imported at/above the start, ${madeHereBelowStart} made here below it`,
    );
  }

  // Made here but numbered below the start, so the rule treats them as brought
  // in: the sweep would leave them alone. Worth knowing which they are.
  for (const quote of strays) {
    console.log(
      `    made here, below the start: #${quote.number} ${quote.status} "${quote.title}" created ${quote.createdAt.toISOString().slice(0, 10)}`,
    );
  }

  console.log("\nBy status");
  for (const [status, counts] of [...byStatus].sort((a, b) => a[0].localeCompare(b[0]))) row(status, counts);

  console.log("\nCustomer emails the sweep would send tonight, if it ran now");
  console.log(
    `  switches: first follow-up ${on.first ? "ON" : "off"} (${company.firstFollowUpDays}d), second ${on.second ? "ON" : "off"} (${company.secondFollowUpDays}d), review ${on.review ? "ON" : "off"} (${company.reviewRequestDays}d, ${reviewPlaces} place(s) to leave one)`,
  );
  row("first follow-up", first, on.first ? "" : "(switched off: would send none)");
  row("second follow-up", second, on.second ? "" : "(switched off: would send none)");
  row("review request", review, !on.review ? "(switched off: would send none)" : reviewPlaces === 0 ? "(no review links: would send none)" : "");

  console.log("\nInternal, if it ran now");
  row("quotes closed as EXPIRED", closing, "(also moves the lead along)");
  row("'about to expire' notices", expiring);

  console.log(
    "\nThe sweep reads at most 500 quotes per company per night, so a company with more than that is worked through over several nights.",
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.slug && args.all !== "true") {
    console.error("Usage: tsx scripts/count-cron-candidates.ts --slug=<company-slug>");
    console.error("   or: tsx scripts/count-cron-candidates.ts --all");
    process.exit(1);
  }

  const companies = await prisma.company.findMany({
    where: args.slug ? { slug: args.slug } : { isActive: true },
    orderBy: { slug: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      quoteNumberStart: true,
      firstFollowUpDays: true,
      secondFollowUpDays: true,
      reviewRequestDays: true,
    },
  });

  if (companies.length === 0) {
    console.error(args.slug ? `No company with slug "${args.slug}".` : "No active companies.");
    process.exit(1);
  }

  console.log("READ-ONLY: this counts, it does not send or change anything.");
  for (const company of companies) await countCompany(company);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
