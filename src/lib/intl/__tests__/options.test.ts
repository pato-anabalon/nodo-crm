import {
  currencyOptions,
  formatLocaleOptions,
  isSupportedCurrency,
  isSupportedFormatLocale,
  isSupportedTimezone,
  timezoneOptions,
} from "../options";

describe("currencies", () => {
  it("accepts the ones the companies on record use", () => {
    expect(isSupportedCurrency("NZD")).toBe(true);
    expect(isSupportedCurrency("AUD")).toBe(true);
    expect(isSupportedCurrency("CLP")).toBe(true);
  });

  // The whole point of the list: these are what a text field used to allow.
  it("rejects what a typo produces", () => {
    expect(isSupportedCurrency("NZ$")).toBe(false);
    expect(isSupportedCurrency("nzd")).toBe(false);
    expect(isSupportedCurrency("XYZ")).toBe(false);
    expect(isSupportedCurrency("")).toBe(false);
  });

  it("leads every label with the code, which is what people type to find it", () => {
    const nzd = currencyOptions("en-GB").find((o) => o.value === "NZD");
    expect(nzd?.label.startsWith("NZD")).toBe(true);
  });

  it("names the currency in the language being read", () => {
    const inSpanish = currencyOptions("es").find((o) => o.value === "NZD");
    const inEnglish = currencyOptions("en-GB").find((o) => o.value === "NZD");
    expect(inSpanish?.label).not.toBe(inEnglish?.label);
  });
});

describe("timezones", () => {
  it("accepts the real ones", () => {
    expect(isSupportedTimezone("Pacific/Auckland")).toBe(true);
    expect(isSupportedTimezone("America/Santiago")).toBe(true);
  });

  // Two letters swapped, and every due date quietly lands in the wrong place.
  it("rejects a misspelling that looks right", () => {
    expect(isSupportedTimezone("Pacific/Aukland")).toBe(false);
    expect(isSupportedTimezone("NZST")).toBe(false);
  });

  it("groups by region so the list can be scanned", () => {
    const groups = timezoneOptions();
    const pacific = groups.find((g) => g.label === "Pacific");
    expect(pacific?.options).toContainEqual({
      value: "Pacific/Auckland",
      label: "Auckland",
    });
  });

  it("offers every zone exactly once across the groups", () => {
    const values = timezoneOptions().flatMap((g) => g.options.map((o) => o.value));
    expect(new Set(values).size).toBe(values.length);
    expect(values.every(isSupportedTimezone)).toBe(true);
  });
});

describe("number and date formats", () => {
  it("accepts the curated tags and nothing else", () => {
    expect(isSupportedFormatLocale("en-NZ")).toBe(true);
    expect(isSupportedFormatLocale("es-CL")).toBe(true);
    expect(isSupportedFormatLocale("en_NZ")).toBe(false);
    expect(isSupportedFormatLocale("en-XX")).toBe(false);
  });

  /**
   * The label is the whole reason this is a select: nobody recognises `en-NZ`,
   * everybody recognises `31/01/2026`. A sample that doesn't show through would
   * leave the person picking between tags again.
   */
  it("shows what the format actually looks like", () => {
    const options = formatLocaleOptions("en-GB");
    const nz = options.find((o) => o.value === "en-NZ");
    const us = options.find((o) => o.value === "en-US");
    const cl = options.find((o) => o.value === "es-CL");

    expect(nz?.label).toContain("31/01/2026");
    expect(us?.label).toContain("1/31/2026");
    expect(cl?.label).toContain("1.234,56");
    expect(nz?.label).toContain("1,234.56");
  });

  it("every option is selectable by the value it carries", () => {
    expect(formatLocaleOptions("es").every((o) => isSupportedFormatLocale(o.value))).toBe(true);
  });
});
