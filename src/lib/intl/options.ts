/**
 * The lists behind every currency, format and timezone picker.
 *
 * These were free text fields until now, which is how a company ends up with
 * `NZ$` in a field that wants `NZD`, or `Pacific/Aukland` spelled with the
 * letters swapped. Nothing complains: the amount silently stops formatting and
 * the dates drift by a day. A closed list is what makes that unrepresentable,
 * so the same lists are used to *render* the options and to *validate* what
 * comes back — a hand-crafted POST is checked against exactly what the select
 * offered.
 *
 * Currencies and timezones come from the platform (`Intl.supportedValuesOf`),
 * so they stay right as ICU updates and nobody maintains them here.
 */

export type Option = { value: string; label: string };
export type OptionGroup = { label: string; options: Option[] };

/** Fixed, and deliberately the 31st: no locale can read it as a month. */
const SAMPLE_DATE = new Date("2026-01-31T12:00:00Z");
const SAMPLE_NUMBER = 1234.56;

// ---------------------------------------------------------------- currencies

const CURRENCIES = Intl.supportedValuesOf("currency");

export function isSupportedCurrency(code: string): boolean {
  return CURRENCIES.includes(code);
}

/**
 * Labelled `NZD — New Zealand Dollar`, with the code first on purpose: typing
 * in an open native select jumps by the option's own text, so the three letters
 * people already know are what gets them there.
 */
export function currencyOptions(displayLocale: string): Option[] {
  const names = new Intl.DisplayNames([displayLocale], { type: "currency" });
  return CURRENCIES.map((code) => ({
    value: code,
    label: `${code} — ${names.of(code) ?? code}`,
  }));
}

// ----------------------------------------------------------------- timezones

const TIMEZONES = Intl.supportedValuesOf("timeZone");

export function isSupportedTimezone(zone: string): boolean {
  return TIMEZONES.includes(zone);
}

/**
 * Grouped by IANA region, because 418 zones in one flat list is not a choice a
 * person can make. The offset is deliberately not in the label: it moves with
 * daylight saving, so half the year it would be a lie.
 */
export function timezoneOptions(): OptionGroup[] {
  const groups = new Map<string, Option[]>();

  for (const zone of TIMEZONES) {
    const slash = zone.indexOf("/");
    const region = slash === -1 ? "Other" : zone.slice(0, slash);
    const rest = slash === -1 ? zone : zone.slice(slash + 1);
    const options = groups.get(region) ?? [];
    options.push({ value: zone, label: rest.replaceAll("_", " ") });
    groups.set(region, options);
  }

  return [...groups]
    .map(([label, options]) => ({ label, options }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// -------------------------------------------------------------- number/date

/**
 * Unlike the two above, there is no list of these to ask the platform for —
 * every language crossed with every region is a valid tag, and almost all of
 * them format identically. So this one is curated: the places this CRM is
 * actually sold and worked in. Adding one is adding a line.
 */
const FORMAT_LOCALES = [
  "en-NZ",
  "en-AU",
  "en-GB",
  "en-IE",
  "en-US",
  "en-CA",
  "en-ZA",
  "en-SG",
  "es-CL",
  "es-AR",
  "es-CO",
  "es-ES",
  "es-MX",
  "es-PE",
] as const;

export function isSupportedFormatLocale(tag: string): boolean {
  return (FORMAT_LOCALES as readonly string[]).includes(tag);
}

/**
 * Shown as a worked example rather than as a tag. Nobody picks `en-NZ` because
 * they recognise the tag; they pick it because `31/01/2026` and `1,234.56` are
 * how their invoices have always looked.
 */
export function formatLocaleOptions(displayLocale: string): Option[] {
  const names = new Intl.DisplayNames([displayLocale], { type: "language" });
  return FORMAT_LOCALES.map((tag) => {
    const date = new Intl.DateTimeFormat(tag, { timeZone: "UTC" }).format(SAMPLE_DATE);
    const number = new Intl.NumberFormat(tag).format(SAMPLE_NUMBER);
    return { value: tag, label: `${names.of(tag) ?? tag} · ${date} · ${number}` };
  });
}
