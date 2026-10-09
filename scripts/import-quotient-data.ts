/**
 * Imports Plaster Pro Solution's historical Quotient data — contacts, leads
 * and quotes — into one company, from the exports under
 * public/plaster-pro-historical-data/.
 *
 * Writes directly with `prisma.*`, the same shape as `prisma/seed.ts` and
 * `src/modules/ingest/service.ts`: there is no `CompanyContext` to build
 * outside a request, and `createQuote`/`createLead` are built to freeze the
 * company's *current* settings onto a new quote, which doesn't apply to
 * data that was already closed years ago.
 *
 * Usage:
 *   npx tsx scripts/import-quotient-data.ts --slug=plasterpro-test
 *
 * Safe to re-run: every Lead/Quote it creates carries the Quotient quote
 * number in `legacyQuotientNumber`, and a row with that number already
 * present is skipped.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });

import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ActivityType, LeadSource, LeadStatus, QuoteSectionKind, QuoteStatus } from "../src/generated/prisma/enums";
import { calculateQuoteTotals, type TaxDisplayMode } from "../src/modules/quotes/totals";
import { attachClientCompany } from "../src/modules/client-companies/attach";
import {
  loadMasterContacts,
  loadPriceItemsByQuoteNumber,
  loadQuoteObjectsByNumber,
  loadSummaryRows,
  type PriceItemRow,
} from "./lib/quotient-data";
import { earliestOf, parseQuotientDate } from "./lib/quotient-dates";

const OUTPUT_DIR = path.join(__dirname, ".output");

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL }),
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Neon drops the odd connection mid-script on a run this long (seen twice,
 * both times partway through, on both the pooled and the unpooled URL). Each
 * write is its own short transaction, so a retry just means redoing one
 * quote's handful of inserts, not the whole run.
 */
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  [retry ${attempt}/${attempts}] ${label}: ${message}`);
      await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

const AMOUNTS_ENTERED_TO_TAX_DISPLAY_MODE: Record<string, TaxDisplayMode> = {
  "Tax Exclusive": "TAX_EXCLUSIVE",
  "Tax Exclusive (Inclusive Total)": "TAX_EXCLUSIVE_INCLUSIVE_TOTAL",
  "Tax Inclusive": "TAX_INCLUSIVE",
  "No Tax": "NO_TAX",
};

const STATUS_TO_QUOTE_STATUS: Record<string, QuoteStatus> = {
  Editing: QuoteStatus.DRAFT,
  "Awaiting Acceptance": QuoteStatus.SENT,
  Accepted: QuoteStatus.ACCEPTED,
  Declined: QuoteStatus.REJECTED,
  Expired: QuoteStatus.EXPIRED,
  Withdrawn: QuoteStatus.EXPIRED,
};

type SectionInput = {
  title: string;
  amount: number;
  kind: QuoteSectionKind;
  selectedByDefault: boolean;
};

function mapSections(priceItems: PriceItemRow[]): SectionInput[] {
  return priceItems.map((row) => {
    let kind: QuoteSectionKind = QuoteSectionKind.INDEPENDENT;
    let selectedByDefault = false;

    switch (row.optional) {
      case "Optional":
        kind = QuoteSectionKind.OPTIONAL;
        break;
      case "Optional, selected":
        kind = QuoteSectionKind.OPTIONAL;
        selectedByDefault = true;
        break;
      case "Multiple choice, selected":
        kind = QuoteSectionKind.MULTIPLE_CHOICE;
        selectedByDefault = true;
        break;
      case "Multiple choice":
        kind = QuoteSectionKind.MULTIPLE_CHOICE;
        break;
      default:
        break;
    }

    return { title: row.itemTitle, amount: row.itemTotal, kind, selectedByDefault };
  });
}

/** 15 if every section is taxed, 0 if none are, a blended rate if mixed. */
function resolveTaxRate(priceItems: PriceItemRow[]): { taxRate: number; mixed: boolean } {
  if (priceItems.length === 0) return { taxRate: 15, mixed: false };

  const taxedTotal = priceItems.filter((r) => r.taxRate !== "No tax").reduce((sum, r) => sum + r.itemTotal, 0);
  const grandTotal = priceItems.reduce((sum, r) => sum + r.itemTotal, 0);

  const allTaxed = priceItems.every((r) => r.taxRate !== "No tax");
  const allExempt = priceItems.every((r) => r.taxRate === "No tax");
  if (allTaxed) return { taxRate: 15, mixed: false };
  if (allExempt) return { taxRate: 0, mixed: false };

  const blended = grandTotal === 0 ? 0 : Math.round(((taxedTotal * 15) / grandTotal) * 100) / 100;
  return { taxRate: blended, mixed: true };
}

function statusToLeadStatus(status: QuoteStatus): LeadStatus {
  switch (status) {
    case QuoteStatus.DRAFT:
      return LeadStatus.NEW;
    case QuoteStatus.SENT:
      return LeadStatus.PROPOSAL;
    case QuoteStatus.ACCEPTED:
      return LeadStatus.WON;
    default:
      return LeadStatus.LOST;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.slug;
  if (!slug) {
    console.error("Usage: tsx scripts/import-quotient-data.ts --slug=<company-slug>");
    process.exit(1);
  }

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) {
    console.error(`No company with slug "${slug}". Run scripts/bootstrap-company.ts first.`);
    process.exit(1);
  }

  console.log(`Importing into "${company.name}" (${company.id})`);

  const summaryRows = loadSummaryRows();
  const priceItemsByQuote = loadPriceItemsByQuoteNumber();
  const quoteObjects = loadQuoteObjectsByNumber();
  const masterContacts = loadMasterContacts();

  console.log(`Loaded ${summaryRows.length} quotes, ${masterContacts.length} contacts.`);

  // --- Pre-load contacts + client companies, keyed by normalised email ---
  const contactByEmail = new Map<
    string,
    { contactId: string; clientCompanyId: string | null; clientCompanyName: string | null }
  >();
  let preloaded = 0;
  for (const c of masterContacts) {
    const { contactId, clientCompanyId } = await withRetry(async () => {
      const clientCompanyId = await attachClientCompany(prisma, company.id, c.companyName || null);

      const existing = await prisma.contact.findFirst({
        where: { companyId: company.id, email: c.email },
        select: { id: true },
      });

      if (existing) return { contactId: existing.id, clientCompanyId };

      const firstName = c.firstName || c.companyName || c.email.split("@")[0] || "Unknown";
      const created = await prisma.contact.create({
        data: {
          companyId: company.id,
          firstName,
          lastName: c.lastName || null,
          email: c.email,
          phone: c.phone || null,
          clientCompanyId,
        },
        select: { id: true },
      });
      return { contactId: created.id, clientCompanyId };
    }, `contact preload ${c.email}`);

    contactByEmail.set(c.email, { contactId, clientCompanyId, clientCompanyName: c.companyName || null });
    preloaded++;
    if (preloaded % 200 === 0) console.log(`  ...${preloaded}/${masterContacts.length} contacts`);
  }
  console.log(`Contacts/companies ready (${contactByEmail.size} emails mapped).`);

  // --- Existing state for this company ---
  const alreadyImported = new Set(
    (
      await withRetry(
        () =>
          prisma.quote.findMany({
            where: { companyId: company.id, legacyQuotientNumber: { not: null } },
            select: { legacyQuotientNumber: true },
          }),
        "load already-imported quote numbers",
      )
    ).map((q) => q.legacyQuotientNumber as number),
  );

  const lastNumber = await withRetry(
    () =>
      prisma.quote.findFirst({
        where: { companyId: company.id },
        orderBy: { number: "desc" },
        select: { number: true },
      }),
    "load last quote number",
  );
  let nextNumber = (lastNumber?.number ?? 0) + 1;

  // --- Sort oldest first, so Quote.number reads chronologically ---
  const dated = summaryRows.map((row) => ({
    row,
    date:
      earliestOf(parseQuotientDate(row.sentWhen), parseQuotientDate(row.lastStatusChange)) ??
      new Date(0),
  }));
  dated.sort((a, b) => a.date.getTime() - b.date.getTime());

  const manifest: Record<string, { nodoQuoteId: string; nodoLeadId: string; signinUrl: string | null }> = {};
  const warnings: string[] = [];

  let created = 0;
  let skipped = 0;

  for (const { row } of dated) {
    if (alreadyImported.has(row.quoteNumber)) {
      skipped++;
      const existingQuote = await withRetry(
        () =>
          prisma.quote.findUnique({
            where: { legacyQuotientNumber: row.quoteNumber },
            select: { id: true, leadId: true },
          }),
        `lookup already-imported quote ${row.quoteNumber}`,
      );
      if (existingQuote) {
        manifest[String(row.quoteNumber)] = {
          nodoQuoteId: existingQuote.id,
          nodoLeadId: existingQuote.leadId ?? "",
          signinUrl: quoteObjects.get(row.quoteNumber)?.signinUrl ?? null,
        };
      }
      continue;
    }

    const priceItems = priceItemsByQuote.get(row.quoteNumber) ?? [];
    if (priceItems.length === 0) {
      warnings.push(`Quote ${row.quoteNumber}: no price item rows — imported with no sections, total $0.`);
    }

    const sections = mapSections(priceItems);
    const { taxRate, mixed } = resolveTaxRate(priceItems);
    if (mixed) {
      warnings.push(
        `Quote ${row.quoteNumber}: mixed taxed/exempt sections — using blended effective tax rate ${taxRate}%.`,
      );
    }

    const taxDisplayMode = AMOUNTS_ENTERED_TO_TAX_DISPLAY_MODE[row.amountsEntered] ?? "TAX_EXCLUSIVE_INCLUSIVE_TOTAL";
    const discountValue = row.overallDiscount ?? 0;

    const totals = calculateQuoteTotals({
      sections: sections.map((s) => s.amount),
      taxRate,
      discount: discountValue,
      discountType: "PERCENT",
      taxDisplayMode,
    });

    if (Math.abs(totals.total - row.totalValue) > 0.01 && row.totalValue !== 0) {
      warnings.push(
        `Quote ${row.quoteNumber}: computed total ${totals.total} differs from CSV "Total value" ${row.totalValue}.`,
      );
    }

    const quoteStatus = STATUS_TO_QUOTE_STATUS[row.status] ?? QuoteStatus.EXPIRED;
    const leadStatus = statusToLeadStatus(quoteStatus);

    const sentAt = parseQuotientDate(row.sentWhen);
    const lastStatusChangeAt = parseQuotientDate(row.lastStatusChange);
    const validUntil = parseQuotientDate(row.expiryDate);
    const decidedAt =
      quoteStatus === QuoteStatus.ACCEPTED || quoteStatus === QuoteStatus.REJECTED ? lastStatusChangeAt : null;
    const closedAt = leadStatus === LeadStatus.WON || leadStatus === LeadStatus.LOST ? lastStatusChangeAt : null;
    const createdAt = earliestOf(sentAt, lastStatusChangeAt) ?? new Date();

    const contactInfo = contactByEmail.get(row.email);
    const contactName = row.forName || [row.firstName, row.lastName].filter(Boolean).join(" ") || null;

    const result = await withRetry(() => prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          companyId: company.id,
          legacyQuotientNumber: row.quoteNumber,
          title: row.title || `Quotient quote ${row.quoteNumber}`,
          status: leadStatus,
          source: LeadSource.OTHER,
          currency: row.currency,
          contactId: contactInfo?.contactId ?? null,
          clientCompanyId: contactInfo?.clientCompanyId ?? null,
          contactName,
          contactEmail: row.email || null,
          companyName: contactInfo?.clientCompanyName ?? null,
          closedAt,
          createdAt,
        },
      });

      const quote = await tx.quote.create({
        data: {
          companyId: company.id,
          legacyQuotientNumber: row.quoteNumber,
          number: nextNumber++,
          leadId: lead.id,
          title: row.title || `Quotient quote ${row.quoteNumber}`,
          status: quoteStatus,
          pricingMode: "SECTIONS",
          clientCompanyName: contactInfo?.clientCompanyName ?? null,
          clientName: contactName,
          clientEmail: row.email || null,
          currency: row.currency,
          taxType: "GST",
          taxRate,
          taxDisplayMode,
          discountType: "PERCENT",
          discountValue,
          discount: totals.discount,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          sentAt,
          validUntil,
          decidedAt,
          createdAt,
          sections: {
            create: sections.map((s, index) => ({
              position: index,
              title: s.title,
              amount: s.amount,
              kind: s.kind,
              selectedByDefault: s.selectedByDefault,
            })),
          },
        },
      });

      if (row.fromName) {
        await tx.activity.create({
          data: {
            companyId: company.id,
            leadId: lead.id,
            type: ActivityType.NOTE,
            content: `Imported from Quotient. Originally quoted by ${row.fromName}.`,
            createdAt,
          },
        });
      }

      await tx.activity.create({
        data: { companyId: company.id, leadId: lead.id, type: ActivityType.RECEIVED, content: "", createdAt },
      });

      if (sentAt) {
        await tx.activity.create({
          data: {
            companyId: company.id,
            leadId: lead.id,
            type: ActivityType.QUOTE_SENT,
            content: `${quote.number}>${QuoteStatus.SENT}`,
            createdAt: sentAt,
          },
        });
      }

      if (decidedAt) {
        await tx.activity.create({
          data: {
            companyId: company.id,
            leadId: lead.id,
            type: ActivityType.QUOTE_DECIDED,
            content: `${quote.number}>${quoteStatus}`,
            createdAt: decidedAt,
          },
        });
      }

      return { leadId: lead.id, quoteId: quote.id };
    }), `quote ${row.quoteNumber}`);

    manifest[String(row.quoteNumber)] = {
      nodoQuoteId: result.quoteId,
      nodoLeadId: result.leadId,
      signinUrl: quoteObjects.get(row.quoteNumber)?.signinUrl ?? null,
    };
    created++;
    if (created % 100 === 0) console.log(`  ...${created} created, ${skipped} skipped so far`);
  }

  fs.mkdirSync(path.join(OUTPUT_DIR, slug), { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, slug, "import-manifest.json"), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, slug, "import-warnings.log"), warnings.join("\n") + "\n");

  console.log(`Created ${created} quotes, skipped ${skipped} already-imported.`);
  console.log(`${warnings.length} warnings written to scripts/.output/${slug}/import-warnings.log`);
  console.log(`Manifest written to scripts/.output/${slug}/import-manifest.json`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
