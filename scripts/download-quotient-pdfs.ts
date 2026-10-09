/**
 * Downloads the original customer-facing PDF for every quote brought in by
 * scripts/import-quotient-data.ts, as a backup of exactly what the customer
 * was actually sent (not a re-render of what's now in Nodo).
 *
 * Quotient's `/print` link needs no login — confirmed live: it 302s to
 * pdf.quotientapp.com and returns `application/pdf` with no session cookie.
 * For every quote that still has a signinUrl, the PDF is saved two ways:
 *   - a local backup copy under quotient-pdf-backups/<quoteNumber>.pdf
 *     (gitignored, outside the app)
 *   - a real QuoteAttachment uploaded to Vercel Blob, visible on the quote
 *     in the app, same as any other attachment
 *
 * Usage:
 *   npx tsx scripts/download-quotient-pdfs.ts --slug=plasterpro-test
 *
 * Reads scripts/.output/<slug>/import-manifest.json, written by script 1.
 * Safe to re-run: a quote that already has this attachment is skipped.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const OUTPUT_DIR = path.join(__dirname, ".output");
const BACKUP_ROOT = path.join(__dirname, "..", "quotient-pdf-backups");
// CloudFront/WAF on go.quotientapp.com rate-limited us at 400ms (confirmed
// 2026-10-08: it started 403ing even the user's own browser on the same IP).
// 3.5s between requests is the slower, sustainable pace.
const DELAY_MS = 3_500;
const ATTACHMENT_PATHNAME_SUFFIX = "quotient-backup.pdf";
// `addRandomSuffix: true` inserts the random string *before* the extension
// (`quotient-backup-<random>.pdf`), so a check for the full suffix above
// never matches an uploaded file — this is the stem that does.
const ATTACHMENT_PATHNAME_MATCH = "quotient-backup";

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

const DB_TIMEOUT_MS = 15_000;

/**
 * Races a DB call against its own deadline, the same reason
 * `fetchWithHardTimeout` races the PDF fetch: over a flaky connection (the
 * VPN this was first run behind, one night, hung a plain indexed lookup for
 * no error and no response — just an established TCP connection with
 * nothing coming back) a query can wedge forever, and nothing here was
 * timing those out. There's no cancel signal for the query itself, so the
 * loser keeps running in the background; that's fine; nothing reads its
 * result.
 */
function withTimeout<T>(promise: Promise<T>, ms: number = DB_TIMEOUT_MS): Promise<T | "timeout"> {
  const deadline = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms));
  return Promise.race([promise, deadline]);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL }),
});

type ManifestEntry = { nodoQuoteId: string; nodoLeadId: string; signinUrl: string | null };

async function fetchWithHardTimeout(url: string, ms: number): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  // Races the real request against its own deadline: some CloudFront/WAF
  // stalls leave the socket open with nothing coming back at all, and an
  // AbortController abort doesn't reliably unstick a fetch() that's wedged
  // like that — the race guarantees this function returns within `ms`
  // regardless of whether the underlying request ever does.
  const deadline = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms));
  try {
    const attempt = (async () => {
      const res = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          Accept: "application/pdf,*/*",
        },
      });
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    })();
    const result = await Promise.race([attempt, deadline]);
    return result === "timeout" ? null : result;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadPdf(signinUrl: string): Promise<Buffer | null> {
  const url = `https://go.quotientapp.com${signinUrl}/print`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await fetchWithHardTimeout(url, 20_000);
    if (result) return result;
    if (attempt === 2) return null;
    await sleep(1000);
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.slug;
  if (!slug) {
    console.error("Usage: tsx scripts/download-quotient-pdfs.ts --slug=<company-slug>");
    process.exit(1);
  }

  // Two attempts, the same shape as `downloadPdf`: the connection that hung
  // here once wasn't wedged on any particular query, just intermittently —
  // over a flaky link that's worth one retry before giving up and asking a
  // person to run it again.
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

  const manifestPath = path.join(OUTPUT_DIR, slug, "import-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(`No manifest at ${manifestPath}. Run scripts/import-quotient-data.ts first.`);
    process.exit(1);
  }
  const manifest: Record<string, ManifestEntry> = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  fs.mkdirSync(BACKUP_ROOT, { recursive: true });

  const entries = Object.entries(manifest);
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const failures: string[] = [];

  // A live line every so often — the only other output used to be the
  // summary at the end, which read as silence for the better part of an
  // hour on a run this size, including through the stretches that were
  // actually a flaky connection quietly timing out one query at a time.
  const PROGRESS_EVERY = 50;

  for (const [index, [quoteNumber, entry]] of entries.entries()) {
    if (index > 0 && index % PROGRESS_EVERY === 0) {
      console.log(
        `  …at quote ${quoteNumber} (${index}/${entries.length}): ${downloaded} downloaded, ${skipped} skipped, ${failed} failed so far.`,
      );
    }
    if (!entry.signinUrl) {
      failed++;
      failures.push(`Quote ${quoteNumber}: no signinUrl in manifest (never sent in Quotient).`);
      continue;
    }

    const existingAttachment = await withTimeout(
      prisma.quoteAttachment.findFirst({
        where: { quoteId: entry.nodoQuoteId, pathname: { contains: ATTACHMENT_PATHNAME_MATCH } },
        select: { id: true },
      }),
    );
    if (existingAttachment === "timeout") {
      failed++;
      const message = `Quote ${quoteNumber}: timed out checking for an existing attachment — left for a re-run.`;
      console.error(message);
      failures.push(message);
      continue;
    }
    if (existingAttachment) {
      skipped++;
      continue;
    }

    const pdf = await downloadPdf(entry.signinUrl);
    if (!pdf) {
      failed++;
      failures.push(`Quote ${quoteNumber}: download failed for ${entry.signinUrl}.`);
      await sleep(DELAY_MS);
      continue;
    }

    fs.writeFileSync(path.join(BACKUP_ROOT, `${quoteNumber}.pdf`), pdf);

    const blob = await put(`companies/${company.id}/quotes/${entry.nodoQuoteId}/${ATTACHMENT_PATHNAME_SUFFIX}`, pdf, {
      access: "public",
      addRandomSuffix: true,
      contentType: "application/pdf",
    });

    const created = await withTimeout(
      prisma.quoteAttachment.create({
        data: {
          quoteId: entry.nodoQuoteId,
          sectionId: null,
          name: `Quotient copy — quote ${quoteNumber}.pdf`,
          url: blob.url,
          pathname: blob.pathname,
          contentType: "application/pdf",
          size: pdf.byteLength,
          uploadedById: null,
        },
      }),
    );
    if (created === "timeout") {
      // The PDF is already in Blob storage either way. If this write landed
      // despite the timeout, the fixed `contains` check above finds it on a
      // re-run and skips it; if it didn't, the re-run uploads it again. The
      // Blob file this attempt already created is only a leftover in the
      // second case, and `clean-orphaned-quote-blobs.ts` is what finds and
      // removes it.
      failed++;
      const message = `Quote ${quoteNumber}: timed out saving the attachment row — left for a re-run.`;
      console.error(message);
      failures.push(message);
      continue;
    }

    downloaded++;
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, slug, "pdf-download-failures.log"), failures.join("\n") + "\n");

  console.log(`Downloaded ${downloaded}, skipped ${skipped} (already attached), failed ${failed}.`);
  console.log(`Local backups in ${BACKUP_ROOT}`);
  console.log(`Failures logged to scripts/.output/${slug}/pdf-download-failures.log`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
