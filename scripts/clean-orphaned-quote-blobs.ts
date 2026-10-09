/**
 * Deletes Blob files under a company's quotes that no `QuoteAttachment` row
 * points at any more.
 *
 * Written for one specific mess: a bug in `download-quotient-pdfs.ts`'s
 * resume check (fixed 2026-10-09 — see the comment on
 * `ATTACHMENT_PATHNAME_MATCH`) re-uploaded 38 quotes that already had their
 * backup, leaving 38 orphaned Blob files behind once the duplicate
 * `QuoteAttachment` rows were cleaned up from the database. The exact
 * pathnames weren't saved before that cleanup, so this derives the orphan
 * list fresh instead: list what Blob actually has, diff against what the
 * database actually references.
 *
 * General-purpose beyond that one mess, too — safe to run again any time
 * something under a company's `quotes/` prefix gets uploaded and the row
 * pointing at it never gets created or outlives it.
 *
 * Usage:
 *   npx tsx scripts/clean-orphaned-quote-blobs.ts --slug=plasterpro-test [--dry-run]
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import { list, del } from "@vercel/blob";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.slug;
  if (!slug) {
    console.error("Usage: tsx scripts/clean-orphaned-quote-blobs.ts --slug=<company-slug> [--dry-run]");
    process.exit(1);
  }
  const dryRun = args["dry-run"] === "true";

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) {
    console.error(`No company with slug "${slug}".`);
    process.exit(1);
  }

  const prefix = `companies/${company.id}/quotes/`;
  const referenced = new Set(
    (
      await prisma.quoteAttachment.findMany({
        where: { quote: { companyId: company.id } },
        select: { pathname: true },
      })
    ).map((row) => row.pathname),
  );

  let cursor: string | undefined;
  let checked = 0;
  let orphaned = 0;
  let freed = 0;

  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    cursor = page.cursor;

    for (const blob of page.blobs) {
      checked += 1;
      if (referenced.has(blob.pathname)) continue;

      orphaned += 1;
      freed += blob.size;
      console.log(`${dryRun ? "[dry-run] would delete" : "deleting"}: ${blob.pathname} (${blob.size} bytes)`);
      if (!dryRun) await del(blob.url);
    }
  } while (cursor);

  console.log(`Checked ${checked} blobs under ${prefix}.`);
  console.log(`${dryRun ? "Would free" : "Freed"} ${orphaned} orphaned files, ${(freed / 1024 / 1024).toFixed(1)} MB.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
