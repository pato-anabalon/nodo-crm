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
 * `--all` instead of `--slug` covers the other way a blob goes orphaned:
 * the company itself got deleted (`Company` cascades `QuoteAttachment` rows,
 * never touches Blob storage). Without a slug there's no companyId to scope
 * the listing to, so this scans the whole `companies/` prefix instead and
 * compares against every `QuoteAttachment.pathname` that still exists,
 * across every company — filtered to paths containing `/quotes/` only, so a
 * company's logo/watermark/terms-document blobs (not tracked by
 * `QuoteAttachment` at all) are never mistaken for orphans.
 *
 * Usage:
 *   npx tsx scripts/clean-orphaned-quote-blobs.ts --slug=plasterpro-test [--dry-run]
 *   npx tsx scripts/clean-orphaned-quote-blobs.ts --all [--dry-run]
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
  const all = args.all === "true";
  if (!slug && !all) {
    console.error("Usage: tsx scripts/clean-orphaned-quote-blobs.ts --slug=<company-slug> [--dry-run]");
    console.error("   or: tsx scripts/clean-orphaned-quote-blobs.ts --all [--dry-run]");
    process.exit(1);
  }
  const dryRun = args["dry-run"] === "true";

  let prefix: string;
  let referenced: Set<string>;

  if (all) {
    prefix = "companies/";
    referenced = new Set(
      (await prisma.quoteAttachment.findMany({ select: { pathname: true } })).map((row) => row.pathname),
    );
  } else {
    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) {
      console.error(`No company with slug "${slug}".`);
      process.exit(1);
    }
    prefix = `companies/${company.id}/quotes/`;
    referenced = new Set(
      (
        await prisma.quoteAttachment.findMany({
          where: { quote: { companyId: company.id } },
          select: { pathname: true },
        })
      ).map((row) => row.pathname),
    );
  }

  let cursor: string | undefined;
  let checked = 0;
  let orphaned = 0;
  let freed = 0;

  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    cursor = page.cursor;

    for (const blob of page.blobs) {
      // En modo --all el prefijo es "companies/" entero, que también trae
      // logos/watermarks/documentos de términos — ninguno de esos pasa por
      // QuoteAttachment, así que filtrar a solo rutas de quotes evita
      // marcarlos como huérfanos por error.
      if (all && !blob.pathname.includes("/quotes/")) continue;

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
