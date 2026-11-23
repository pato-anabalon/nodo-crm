/**
 * Puts the team's past decisions on quotes into the quote's own log.
 *
 * A quote accepted or declined by somebody on the team (`changeQuoteStatus`)
 * used to leave only a `QUOTE_DECIDED` line in the lead's activity, with its
 * author; the quote's log (`QuoteEvent`) recorded decisions made through the
 * customer's link and nothing else. That function now writes the event too;
 * this writes it for the decisions made before, at the time they were made,
 * from those lead lines.
 *
 * Only lines with an author are read: the portal and the nightly sweep write
 * theirs with none, and both already have (or need) no team event. A quote
 * that had no lead left no line, so there is nothing to recover for it. Every
 * company is walked; a decision that already has its team event is skipped,
 * so running it again writes nothing. Read-only unless `--apply` is passed.
 *
 * Usage:
 *   npx tsx scripts/backfill-quote-decision-authors.ts            # counts only
 *   npx tsx scripts/backfill-quote-decision-authors.ts --apply
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { ActivityType, PrismaClient, QuoteEventType } from "../src/generated/prisma/client";

// Same choice as the other data scripts: the direct connection when there is one.
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const apply = process.argv.includes("--apply");

const EVENT_FOR: Record<string, QuoteEventType> = {
  ACCEPTED: QuoteEventType.ACCEPTED,
  REJECTED: QuoteEventType.DECLINED,
};

async function main() {
  // Says which database this is before anything else: `.env.local` points at the
  // test one unless the command overrides it.
  console.log(`Database: ${new URL(connectionString ?? "postgres://unset").hostname}`);

  // Through `prisma` on purpose: a one-off script across companies, each query
  // bounded by the `companyId` of the line it came from.
  const lines = await prisma.activity.findMany({
    where: { type: ActivityType.QUOTE_DECIDED, userId: { not: null }, leadId: { not: null } },
    select: {
      companyId: true,
      leadId: true,
      content: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows: Array<{
    companyId: string;
    quoteId: string;
    type: QuoteEventType;
    userId: string;
    userName: string;
    createdAt: Date;
  }> = [];
  let unreadable = 0;
  let noQuote = 0;
  let present = 0;

  for (const line of lines) {
    // `<number>>ACCEPTED`; expirations and anything else are not team decisions.
    const [number, to] = line.content.split(">");
    const type = EVENT_FOR[to ?? ""];
    if (!type) continue;
    if (!/^\d+$/.test(number ?? "") || !line.userId) {
      unreadable += 1;
      continue;
    }

    const quote = await prisma.quote.findFirst({
      where: { companyId: line.companyId, number: Number(number), leadId: line.leadId },
      select: { id: true },
    });
    if (!quote) {
      noQuote += 1;
      continue;
    }

    const existing = await prisma.quoteEvent.findFirst({
      where: { quoteId: quote.id, type, userId: line.userId, createdAt: line.createdAt },
      select: { id: true },
    });
    if (existing) {
      present += 1;
      continue;
    }

    rows.push({
      companyId: line.companyId,
      quoteId: quote.id,
      type,
      userId: line.userId,
      // Frozen as the live code freezes it; a deleted account left no name to read.
      userName: line.user?.name || line.user?.email || "",
      createdAt: line.createdAt,
    });
  }

  console.log(`${lines.length} team decision lines on leads.`);
  console.log(`${rows.length} to write, ${present} already in the quote's log.`);
  if (noQuote) console.log(`${noQuote} point at a quote that no longer exists (deleted, or moved to another lead).`);
  if (unreadable) console.log(`${unreadable} could not be read.`);

  if (!apply) {
    console.log("Nothing written. Run again with --apply.");
    return;
  }

  await prisma.quoteEvent.createMany({ data: rows.map((row) => ({ ...row, userName: row.userName || null })) });
  console.log(`✓ ${rows.length} events written.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
