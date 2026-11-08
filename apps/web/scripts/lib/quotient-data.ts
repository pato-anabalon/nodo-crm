/**
 * Reads the raw Quotient export (public/plaster-pro-historical-data) into
 * plain in-memory structures. No Prisma here — this is just CSV/JSON parsing
 * and grouping, so it can be read and (if it ever needs to be) tested without
 * a database.
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const DATA_DIR = path.join(__dirname, "..", "..", "public", "plaster-pro-historical-data");
const EXPORT_DIR = path.join(DATA_DIR, "export-data");
const OBJECTS_DIR = path.join(DATA_DIR, "quote-list-objects");

function readCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, { columns: true, skip_empty_lines: true, bom: true });
}

export type SummaryRow = {
  quoteNumber: number;
  title: string;
  fromName: string;
  forName: string;
  firstName: string;
  lastName: string;
  email: string;
  totalValue: number;
  currency: string;
  amountsEntered: string;
  overallDiscount: number | null;
  status: string;
  lastStatusChange: string;
  sentWhen: string;
  expiryDate: string;
};

function parseMoney(raw: string): number {
  const cleaned = raw.replace(/,/g, "").trim();
  return cleaned === "" ? 0 : Number(cleaned);
}

export function loadSummaryRows(): SummaryRow[] {
  const files = fs
    .readdirSync(EXPORT_DIR)
    .filter((f) => f.startsWith("Quotient - Summary of Quotes - "))
    .sort();

  const rows: SummaryRow[] = [];
  for (const file of files) {
    const raw = readCsv(path.join(EXPORT_DIR, file));
    for (const r of raw) {
      rows.push({
        quoteNumber: Number(r["Quote number"]),
        title: r["Quote title"]?.trim() ?? "",
        fromName: r["From name"]?.trim() ?? "",
        forName: r["For name"]?.trim() ?? "",
        firstName: r["First name"]?.trim() ?? "",
        lastName: r["Last name"]?.trim() ?? "",
        email: r["Email"]?.trim().toLowerCase() ?? "",
        totalValue: parseMoney(r["Total value"] ?? ""),
        currency: r["Currency"]?.trim() || "NZD",
        amountsEntered: r["Amounts entered"]?.trim() ?? "",
        overallDiscount: r["Overall discount"]?.trim() ? parseMoney(r["Overall discount"]) : null,
        status: r["Quote status"]?.trim() ?? "",
        lastStatusChange: r["Last status change"]?.trim() ?? "",
        sentWhen: r["Sent when"]?.trim() ?? "",
        expiryDate: r["Expiry date"]?.trim() ?? "",
      });
    }
  }
  return rows;
}

export type PriceItemRow = {
  quoteNumber: number;
  itemTitle: string;
  itemTotal: number;
  taxRate: string;
  optional: string;
};

export function loadPriceItemsByQuoteNumber(): Map<number, PriceItemRow[]> {
  const files = fs
    .readdirSync(EXPORT_DIR)
    .filter((f) => f.startsWith("Quotient - Price Items within Quotes - "))
    .sort();

  const byQuote = new Map<number, PriceItemRow[]>();
  for (const file of files) {
    const raw = readCsv(path.join(EXPORT_DIR, file));
    for (const r of raw) {
      const quoteNumber = Number(r["Quote number"]);
      const row: PriceItemRow = {
        quoteNumber,
        itemTitle: r["Item title"]?.trim() || r["Item code"]?.trim() || "Item",
        itemTotal: parseMoney(r["Item total"] ?? ""),
        taxRate: r["Tax rate"]?.trim() ?? "",
        optional: r["Optional"]?.trim() ?? "",
      };
      const list = byQuote.get(quoteNumber);
      if (list) list.push(row);
      else byQuote.set(quoteNumber, [row]);
    }
  }
  return byQuote;
}

export type ContactRow = {
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  phone: string;
  lastChanged: string;
};

const PHONE_LIKE = /^[\d\s+\-()]+$/;

/** Only the rows with a real email — the only ones a quote can ever match. */
export function loadMasterContacts(): ContactRow[] {
  const raw = readCsv(path.join(EXPORT_DIR, "Quotient - Contacts - All.csv"));
  const byEmail = new Map<string, ContactRow>();

  for (const r of raw) {
    const email = r["Email"]?.trim().toLowerCase();
    if (!email) continue;

    const companyNameRaw = r["Company name"]?.trim() ?? "";
    const row: ContactRow = {
      email,
      firstName: r["First name"]?.trim() ?? "",
      lastName: r["Last name"]?.trim() ?? "",
      companyName: PHONE_LIKE.test(companyNameRaw) ? "" : companyNameRaw,
      phone: r["Phone"]?.trim() ?? "",
      lastChanged: r["Last changed"]?.trim() ?? "",
    };

    const existing = byEmail.get(email);
    if (!existing || row.lastChanged > existing.lastChanged) {
      byEmail.set(email, row);
    }
  }

  return [...byEmail.values()];
}

export type QuotientQuoteObject = {
  quoteNo: number;
  signinUrl: string | null;
  status: string;
};

export function loadQuoteObjectsByNumber(): Map<number, QuotientQuoteObject> {
  const files = fs
    .readdirSync(OBJECTS_DIR)
    .filter((f) => /^page\d+\.json$/.test(f));

  const byNumber = new Map<number, QuotientQuoteObject>();
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(OBJECTS_DIR, file), "utf-8"));
    for (const q of data.GenQuoteCombo ?? []) {
      byNumber.set(q.quote_no, {
        quoteNo: q.quote_no,
        signinUrl: q._signinUrl ?? null,
        status: q.status ?? "",
      });
    }
  }
  return byNumber;
}
