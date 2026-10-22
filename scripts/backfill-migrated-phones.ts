/**
 * Copies the contact's phone onto quotes and leads brought in from Quotient.
 *
 * The importer used to save the phone on the `Contact` only, so the quote's
 * `clientPhone` and the lead's `contactPhone` stayed empty — and everything that
 * reads the quote's own copy (the CSV export, the document) showed no phone.
 * The importer now writes both; this fixes what was already imported.
 *
 * Scoped on purpose to one company (PlasterPro, slug `plasterprosolution`, or another
 * with `--company=<slug>`) and to quotes numbered below 3000 — the range the
 * import filled; anything numbered above it was made here and already carries
 * its phone. A lead is touched only through such a quote. Only rows with a
 * `legacyQuotientNumber` and an empty phone are changed, never one that already
 * has a value, so running it again changes nothing. Read-only unless `--apply`
 * is passed.
 *
 * Usage:
 *   npx tsx scripts/backfill-migrated-phones.ts            # counts only
 *   npx tsx scripts/backfill-migrated-phones.ts --apply
 *   npx tsx scripts/backfill-migrated-phones.ts --company=plasterpro-test
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Same choice as the other data scripts (import, promote): the direct
// connection when there is one, which suits a long run of single updates.
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const apply = process.argv.includes("--apply");
const slug = process.argv.find((arg) => arg.startsWith("--company="))?.slice("--company=".length) ?? "plasterprosolution";
const BELOW_NUMBER = 3000;

async function main() {
  // Says which database this is before anything else: `.env.local` points at the
  // test one unless the command overrides it.
  console.log(`Database: ${new URL(connectionString ?? "postgres://unset").hostname}`);

  const company = await prisma.company.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!company) throw new Error(`No company with slug "${slug}".`);
  console.log(`${company.name} (${slug}), quotes numbered below ${BELOW_NUMBER}.`);

  // Through `prisma` on purpose: a one-off script with no session, bounded by an
  // explicit `companyId` on every query.
  const quotes = await prisma.quote.findMany({
    where: {
      companyId: company.id,
      number: { lt: BELOW_NUMBER },
      legacyQuotientNumber: { not: null },
      OR: [{ clientPhone: null }, { clientPhone: "" }],
      lead: { contact: { phone: { not: null } } },
    },
    select: { id: true, lead: { select: { contact: { select: { phone: true } } } } },
  });
  // The leads of those same quotes, not every migrated lead in the company.
  const leads = await prisma.lead.findMany({
    where: {
      companyId: company.id,
      legacyQuotientNumber: { not: null },
      OR: [{ contactPhone: null }, { contactPhone: "" }],
      contact: { phone: { not: null } },
      quotes: { some: { number: { lt: BELOW_NUMBER } } },
    },
    select: { id: true, contact: { select: { phone: true } } },
  });

  const quoteRows = quotes.flatMap((q) => (q.lead?.contact?.phone ? [{ id: q.id, phone: q.lead.contact.phone }] : []));
  const leadRows = leads.flatMap((l) => (l.contact?.phone ? [{ id: l.id, phone: l.contact.phone }] : []));
  console.log(`${quoteRows.length} quotes and ${leadRows.length} leads are missing a phone their contact has.`);

  if (!apply) {
    console.log("Nothing written. Run again with --apply.");
    return;
  }

  for (const row of quoteRows) await prisma.quote.update({ where: { id: row.id }, data: { clientPhone: row.phone } });
  for (const row of leadRows) await prisma.lead.update({ where: { id: row.id }, data: { contactPhone: row.phone } });
  console.log(`✓ ${quoteRows.length} quotes and ${leadRows.length} leads updated.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
