/**
 * Attaches the Quotient PDFs already downloaded locally — by
 * `download-quotient-pdfs.ts`, once, against `plasterpro-test` — to the
 * matching quotes in whichever database `DATABASE_URL` points at. Meant for
 * production, once it exists: the PDFs themselves don't need fetching from
 * Quotient's CloudFront a second time, only matching and uploading.
 *
 * Matches by `legacyQuotientNumber`, not the old manifest's `nodoQuoteId`:
 * production's own `import-quotient-data.ts` run mints its own ids, and a
 * quote's visible `number` (the one `COT-NNNNNN` is built from) isn't the
 * Quotient number either — the import skips rows with no usable data, so
 * Nodo's counter drifts from Quotient's the further in you go (quote 1980 in
 * Quotient landed on Nodo's own #1936 here, for instance).
 *
 * Usage:
 *   npx tsx scripts/attach-local-quotient-pdfs.ts --slug=<company-slug> [--source=<path>]
 *
 * `--source` defaults to ../quotient-pdf-backups (this script's own sibling
 * directory) — only needed if the files were copied somewhere else first.
 *
 * Safe to re-run: a quote that already has this attachment is skipped, the
 * same check `download-quotient-pdfs.ts` uses.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const OUTPUT_DIR = path.join(__dirname, ".output");
const DEFAULT_SOURCE = path.join(__dirname, "..", "quotient-pdf-backups");
const DELAY_MS = 150;
const ATTACHMENT_PATHNAME_SUFFIX = "quotient-backup.pdf";
// Same stem `download-quotient-pdfs.ts` checks against: `addRandomSuffix`
// inserts the random string before the extension, so a `contains` check is
// what actually matches an uploaded file, not `endsWith`.
const ATTACHMENT_PATHNAME_MATCH = "quotient-backup";

const DB_TIMEOUT_MS = 15_000;

/**
 * Races a DB call against its own deadline — see the matching comment in
 * `download-quotient-pdfs.ts`: over a flaky connection a query can wedge
 * forever with no error and nothing coming back, and this is what keeps one
 * stuck quote from stalling the whole run instead of just being left for a
 * re-run.
 */
function withTimeout<T>(promise: Promise<T>, ms: number = DB_TIMEOUT_MS): Promise<T | "timeout"> {
  const deadline = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms));
  return Promise.race([promise, deadline]);
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL }),
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.slug;
  if (!slug) {
    console.error("Usage: tsx scripts/attach-local-quotient-pdfs.ts --slug=<company-slug> [--source=<path>]");
    process.exit(1);
  }
  const sourceDir = args.source ? path.resolve(args.source) : DEFAULT_SOURCE;

  let company: Awaited<ReturnType<typeof prisma.company.findUnique>> | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await withTimeout(prisma.company.findUnique({ where: { slug } }));
    if (result !== "timeout") {
      company = result;
      break;
    }
    console.error(`Timed out looking up company "${slug}" (attempt ${attempt}/2)${attempt < 2 ? ", retrying…" : ""}`);
  }
  if (!company) {
    console.error(`No company with slug "${slug}".`);
    process.exit(1);
  }

  if (!fs.existsSync(sourceDir)) {
    console.error(`No local backups at ${sourceDir}.`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(sourceDir)
    .filter((name) => name.endsWith(".pdf"))
    .map((name) => ({ name, quoteNumber: Number.parseInt(name.replace(/\.pdf$/, ""), 10) }))
    .filter((entry) => Number.isInteger(entry.quoteNumber));

  fs.mkdirSync(path.join(OUTPUT_DIR, slug), { recursive: true });

  let attached = 0;
  let skipped = 0;
  let failed = 0;
  const failures: string[] = [];
  const PROGRESS_EVERY = 50;

  for (const [index, file] of files.entries()) {
    if (index > 0 && index % PROGRESS_EVERY === 0) {
      console.log(
        `  …at ${file.name} (${index}/${files.length}): ${attached} attached, ${skipped} skipped, ${failed} failed so far.`,
      );
    }

    const quote = await withTimeout(
      prisma.quote.findFirst({
        where: { companyId: company.id, legacyQuotientNumber: file.quoteNumber },
        select: { id: true },
      }),
    );
    if (quote === "timeout") {
      failed++;
      const message = `${file.name}: timed out looking up the quote — left for a re-run.`;
      console.error(message);
      failures.push(message);
      continue;
    }
    if (!quote) {
      failed++;
      failures.push(`${file.name}: no quote with legacyQuotientNumber=${file.quoteNumber} in "${slug}".`);
      continue;
    }

    const existingAttachment = await withTimeout(
      prisma.quoteAttachment.findFirst({
        where: { quoteId: quote.id, pathname: { contains: ATTACHMENT_PATHNAME_MATCH } },
        select: { id: true },
      }),
    );
    if (existingAttachment === "timeout") {
      failed++;
      const message = `${file.name}: timed out checking for an existing attachment — left for a re-run.`;
      console.error(message);
      failures.push(message);
      continue;
    }
    if (existingAttachment) {
      skipped++;
      continue;
    }

    const pdf = fs.readFileSync(path.join(sourceDir, file.name));
    const blob = await put(`companies/${company.id}/quotes/${quote.id}/${ATTACHMENT_PATHNAME_SUFFIX}`, pdf, {
      access: "public",
      addRandomSuffix: true,
      contentType: "application/pdf",
    });

    const created = await withTimeout(
      prisma.quoteAttachment.create({
        data: {
          quoteId: quote.id,
          sectionId: null,
          name: `Quotient copy — quote ${file.quoteNumber}.pdf`,
          url: blob.url,
          pathname: blob.pathname,
          contentType: "application/pdf",
          size: pdf.byteLength,
          uploadedById: null,
        },
      }),
    );
    if (created === "timeout") {
      // The file is already in Blob storage either way — see the matching
      // comment in `download-quotient-pdfs.ts`: a re-run either finds this
      // row (if it landed despite the timeout) or uploads a fresh copy, and
      // `clean-orphaned-quote-blobs.ts` is what cleans up a stray second one.
      failed++;
      const message = `${file.name}: timed out saving the attachment row — left for a re-run.`;
      console.error(message);
      failures.push(message);
      continue;
    }

    attached++;
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, slug, "attach-local-pdfs-failures.log"), failures.join("\n") + "\n");

  console.log(`Attached ${attached}, skipped ${skipped} (already attached), failed ${failed}.`);
  console.log(`Failures logged to scripts/.output/${slug}/attach-local-pdfs-failures.log`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
