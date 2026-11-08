import { wallClock, zonedInstant } from "@/lib/zoned-time";
import { formatQuoteNumber } from "@/lib/format";

/**
 * What goes into the quotes CSV, kept apart from the query and the route so the
 * rules that matter — which columns a profile gets, how a cell is made safe, which
 * instants make up a year — can be checked without a database.
 */

/** Excel opens a UTF-8 file as Windows-1252 unless this is the first thing in it. */
export const CSV_BOM = "﻿";

export const QUOTE_EXPORT_COLUMNS = [
  { key: "reference", amount: false },
  { key: "title", amount: false },
  { key: "status", amount: false },
  { key: "customer", amount: false },
  { key: "customerCompany", amount: false },
  { key: "email", amount: false },
  { key: "phone", amount: false },
  { key: "created", amount: false },
  { key: "sent", amount: false },
  { key: "decided", amount: false },
  { key: "validUntil", amount: false },
  { key: "opens", amount: false },
  // Whether the tax is already inside the total or added on top: without it the
  // Tax column can be read either way. It leads the priced columns so it is read
  // before any figure it explains.
  { key: "taxMode", amount: true },
  // Amounts only ever add up inside one currency, so it travels with them.
  { key: "currency", amount: true },
  { key: "subtotal", amount: true },
  { key: "discount", amount: true },
  { key: "tax", amount: true },
  { key: "total", amount: true },
] as const;

export type QuoteExportColumn = (typeof QUOTE_EXPORT_COLUMNS)[number]["key"];

/**
 * The columns a profile gets. Without `quotes.read.amounts` the priced ones are
 * not blank but absent: an empty column reads as "these quotes have no price",
 * and the file is the one place the permission could otherwise be walked around.
 */
export function exportColumns(canSeeAmounts: boolean): QuoteExportColumn[] {
  return QUOTE_EXPORT_COLUMNS.filter((column) => canSeeAmounts || !column.amount).map((column) => column.key);
}

/**
 * One cell, quoted when it needs it.
 *
 * A text that starts with `=`, `+`, `-`, `@`, a tab or a return is read by a
 * spreadsheet as a formula, and a quote's title or a customer's name is written
 * by whoever filled in a web form. A leading apostrophe makes it text. Numbers
 * are written as they are: a negative figure is a figure, not a formula.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return String(value);

  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",") + "\r\n";
}

/**
 * The instants a calendar year of the company's own clocks runs between: from
 * midnight on 1 January to midnight on the next one, in its timezone. A quote
 * made late on 31 December in Auckland belongs to that year even though it is
 * still the afternoon in UTC.
 */
export function yearBounds(year: number, timeZone: string): { from: Date; to: Date } {
  return {
    from: zonedInstant(`${year}-01-01`, "00:00", timeZone),
    to: zonedInstant(`${year + 1}-01-01`, "00:00", timeZone),
  };
}

/** The year the company's clocks read at this instant. */
export function yearOf(instant: Date, timeZone: string): number {
  return Number(wallClock(instant, timeZone).day.slice(0, 4));
}

export type ExportableQuote = {
  number: number;
  title: string;
  status: string;
  clientName: string | null;
  clientCompanyName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  createdAt: Date;
  sentAt: Date | null;
  decidedAt: Date | null;
  validUntil: Date | null;
  currency: string;
  share: { openCount: number } | null;
  // Present only when the profile may see amounts: they aren't even read otherwise.
  subtotal?: { toString(): string } | null;
  discount?: { toString(): string } | null;
  taxAmount?: { toString(): string } | null;
  taxDisplayMode?: string | null;
  total?: { toString(): string } | null;
};

const money = (value: { toString(): string } | null | undefined) =>
  value === null || value === undefined ? "" : Number(value.toString()).toFixed(2);

/** One quote as the cells of the columns given, in that order. */
export function quoteExportCells(
  quote: ExportableQuote,
  columns: QuoteExportColumn[],
  context: {
    quotePrefix: string;
    timeZone: string;
    statusLabel: (status: string) => string;
    taxModeLabel: (mode: string) => string;
  },
): (string | number | null)[] {
  const day = (date: Date | null) => (date ? wallClock(date, context.timeZone).day : "");

  const values: Record<QuoteExportColumn, string | number | null> = {
    reference: formatQuoteNumber(context.quotePrefix, quote.number),
    title: quote.title,
    status: context.statusLabel(quote.status),
    customer: quote.clientName,
    customerCompany: quote.clientCompanyName,
    email: quote.clientEmail,
    phone: quote.clientPhone,
    created: day(quote.createdAt),
    sent: day(quote.sentAt),
    decided: day(quote.decidedAt),
    validUntil: day(quote.validUntil),
    opens: quote.share?.openCount ?? 0,
    currency: quote.currency,
    subtotal: money(quote.subtotal),
    discount: money(quote.discount),
    tax: money(quote.taxAmount),
    taxMode: quote.taxDisplayMode ? context.taxModeLabel(quote.taxDisplayMode) : "",
    total: money(quote.total),
  };

  return columns.map((column) => values[column]);
}
