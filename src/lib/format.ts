/**
 * Formatting for money, numbers and dates.
 *
 * The interface language belongs to each user, but how money looks belongs to
 * the company: a New Zealand business shows NZD in en-NZ format even if its sales
 * manager works in Spanish. That's why these functions always ask for the
 * company's format locale, never the user's language.
 */

/** Currencies without decimals, where showing cents would be wrong. */
const ZERO_DECIMAL_CURRENCIES = new Set(["CLP", "JPY", "KRW", "VND", "ISK"]);

export function formatMoney(amount: number, currency: string, formatLocale: string): string {
  const fractionDigits = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  return new Intl.NumberFormat(formatLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

export function formatNumber(value: number, formatLocale: string): string {
  return new Intl.NumberFormat(formatLocale).format(value);
}

export function formatDate(date: Date, formatLocale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(formatLocale, { dateStyle: "long", timeZone }).format(date);
}

export function formatDateTime(date: Date, formatLocale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(formatLocale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

/** `COT-000042` */
export function formatQuoteNumber(prefix: string, number: number): string {
  return `${prefix}-${String(number).padStart(6, "0")}`;
}

/**
 * Shortens a long text for a table cell.
 *
 * The ellipsis counts towards the limit, so the cell never grows past it by one
 * character. A trailing space before the ellipsis is dropped, which is the
 * difference between "Plaster on …" and "Plaster on…".
 */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
