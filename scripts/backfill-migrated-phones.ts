/**
 * Copies the contact's phone onto quotes and leads brought in from Quotient.
 *
 * The importer used to save the phone on the `Contact` only, so the quote's
 * `clientPhone` and the lead's `contactPhone` stayed empty — and everything that
 * reads the quote's own copy (the CSV export, the document) showed no phone.
 * The importer now writes both; this fixes what was already imported.
 *
 * Only rows with a `legacyQuotientNumber` and an empty phone are touched, and
 * never one that already has a value, so running it again changes nothing.
 * Read-only unless `--apply` is passed.
 *
 * Usage:
 *   npx tsx scripts/backfill-migrated-phones.ts            # counts only
 *   npx tsx scripts/backfill-migrated-phones.ts --apply
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const apply = process.argv.includes("--apply");

async function main() {
  // Through `prisma` on purpose: this crosses companies by design, and every
  // match is bounded by the lead's own contact, which belongs to its company.
  const quotes = await prisma.quote.findMany({
    where: {
      legacyQuotientNumber: { not: null },
      OR: [{ clientPhone: null }, { clientPhone: "" }],
      lead: { contact: { phone: { not: null } } },
    },
    select: { id: true, lead: { select: { contact: { select: { phone: true } } } } },
  });
  const leads = await prisma.lead.findMany({
    where: {
      legacyQuotientNumber: { not: null },
      OR: [{ contactPhone: null }, { contactPhone: "" }],
      contact: { phone: { not: null } },
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
