import { acceptanceSettingsSchema, checkbox, companyProfileSchema, quoteSettingsSchema, reviewSchema } from "../schemas";

const baseProfile = {
  name: "PlasterPro Solution",
  primaryColor: "#14615e",
  accentColor: "#0f172a",
};

describe("companyProfileSchema", () => {
  it("accepts a minimal profile", () => {
    expect(companyProfileSchema.safeParse(baseProfile).success).toBe(true);
  });

  it("turns empty fields into null, not into an empty string", () => {
    const result = companyProfileSchema.safeParse({ ...baseProfile, taxId: "", website: "" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.taxId).toBeNull();
    expect(result.data.website).toBeNull();
  });

  it("requires a valid hex colour", () => {
    expect(companyProfileSchema.safeParse({ ...baseProfile, primaryColor: "verde" }).success).toBe(false);
    expect(companyProfileSchema.safeParse({ ...baseProfile, primaryColor: "#fff" }).success).toBe(true);
  });

  it("validates the email only if it arrives with content", () => {
    expect(companyProfileSchema.safeParse({ ...baseProfile, email: "" }).success).toBe(true);
    expect(companyProfileSchema.safeParse({ ...baseProfile, email: "no-es" }).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(companyProfileSchema.safeParse({ ...baseProfile, name: "" }).success).toBe(false);
  });
});

const baseQuoteSettings = {
  currency: "nzd",
  formatLocale: "en-NZ",
  timezone: "Pacific/Auckland",
  defaultLanguage: "EN_GB",
  defaultTaxType: "GST",
  defaultTaxRate: "15",
  pricesIncludeTax: false,
  quotePrefix: "cot",
  quoteValidityDays: "30",
};

describe("quoteSettingsSchema", () => {
  it("normalises currency and prefix to uppercase", () => {
    const result = quoteSettingsSchema.safeParse(baseQuoteSettings);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.currency).toBe("NZD");
    expect(result.data.quotePrefix).toBe("COT");
  });

  it("requires three currency letters", () => {
    expect(quoteSettingsSchema.safeParse({ ...baseQuoteSettings, currency: "NZDD" }).success).toBe(false);
  });

  it("clamps the rate to the 0-100 range", () => {
    expect(quoteSettingsSchema.safeParse({ ...baseQuoteSettings, defaultTaxRate: "150" }).success).toBe(false);
    expect(quoteSettingsSchema.safeParse({ ...baseQuoteSettings, defaultTaxRate: "0" }).success).toBe(true);
  });

  it("does not accept a validity of zero days", () => {
    expect(quoteSettingsSchema.safeParse({ ...baseQuoteSettings, quoteValidityDays: "0" }).success).toBe(false);
  });
});

describe("acceptanceSettingsSchema", () => {
  it("accepts the setup from the Quotient example", () => {
    const result = acceptanceSettingsSchema.safeParse({
      acceptanceMode: "STATEMENT_WITH_CHECKBOX",
      acceptanceStatement: "agree to and accept this quote",
      requireSignature: true,
      askAdditionalComments: true,
      askOrderReference: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invented mode", () => {
    const result = acceptanceSettingsSchema.safeParse({
      acceptanceMode: "SIGNATURE_ONLY",
      requireSignature: false,
      askAdditionalComments: false,
      askOrderReference: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("reviewSchema", () => {
  const base = {
    author: "Christine Scott",
    rating: "5",
    body: "Rolando and his team were first class! Efficient and tidy.",
    source: "GOOGLE",
    featured: true,
  };

  it("accepts a complete review", () => {
    expect(reviewSchema.safeParse(base).success).toBe(true);
  });

  it("clamps the stars to 1-5", () => {
    expect(reviewSchema.safeParse({ ...base, rating: "6" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...base, rating: "0" }).success).toBe(false);
  });

  it("requires the link to be an http URL", () => {
    expect(reviewSchema.safeParse({ ...base, sourceUrl: "google.com" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...base, sourceUrl: "https://g.co/r/1" }).success).toBe(true);
    expect(reviewSchema.safeParse({ ...base, sourceUrl: "" }).success).toBe(true);
  });

  it("rejects a review too short to say anything", () => {
    expect(reviewSchema.safeParse({ ...base, body: "Buenos" }).success).toBe(false);
  });
});

describe("checkbox", () => {
  it("a ticked checkbox arrives as 'on'", () => {
    const fd = new FormData();
    fd.set("featured", "on");
    expect(checkbox(fd, "featured")).toBe(true);
  });

  it("an unticked checkbox does not travel in the form and is false", () => {
    expect(checkbox(new FormData(), "featured")).toBe(false);
  });
});

/**
 * These three were free text until the selects existed. The schema is what
 * still holds when the request doesn't come from the select.
 */
describe("quoteSettingsSchema: the closed lists", () => {
  const valid = {
    currency: "NZD",
    formatLocale: "en-NZ",
    timezone: "Pacific/Auckland",
    defaultLanguage: "EN_GB",
    defaultTaxType: "GST",
    defaultTaxRate: "15",
    pricesIncludeTax: "on",
    quotePrefix: "COT",
    quoteValidityDays: "30",
  };

  it("accepts a well-formed set", () => {
    expect(quoteSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it("still uppercases the currency on the way in", () => {
    const result = quoteSettingsSchema.safeParse({ ...valid, currency: "nzd" });
    expect(result.success && result.data.currency).toBe("NZD");
  });

  it.each([
    ["currency", "NZ$"],
    ["currency", "XYZ"],
    ["formatLocale", "en_NZ"],
    ["timezone", "Pacific/Aukland"],
  ])("rejects %s = %s", (field, value) => {
    expect(quoteSettingsSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });
});
