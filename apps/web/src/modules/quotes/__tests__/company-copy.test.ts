import { readFileSync } from "node:fs";
import { join } from "node:path";
import { quoteSettingsSchema } from "@/modules/settings/schemas";

/**
 * The texts that travel with every quote, and the company field each one
 * falls back to.
 *
 * `terms` was the odd one out for a long time, and invisibly so: the template
 * saved it, the duplicate carried it, the portal printed it — every layer
 * treated it like the other three except the one that offered a company-wide
 * default. `createQuote` said `terms: values.terms ?? null` where its three
 * neighbours said `?? ctx.company.quoteX`, which is not something you notice
 * reading either line on its own. `scope` joined the set later, from day one
 * following the same pattern as the first four — this test is what keeps a
 * sixth text from arriving half wired the same way `terms` once did.
 */
const TEXTS = {
  intro: "quoteIntro",
  notes: "quoteNotes",
  exclusions: "quoteExclusions",
  terms: "quoteTerms",
  scope: "quoteScope",
} as const;

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("the company's copy reaches every quote", () => {
  const service = read("src", "modules", "quotes", "service.ts");
  const newQuote = read("src", "app", "s", "[slug]", "(app)", "quotes", "new", "page.tsx");

  it.each(Object.entries(TEXTS))(
    "a new quote falls back to the company's %s",
    (field, companyField) => {
      // Wrapped in `cleanBody` since all four became rich text: sanitised the
      // same way a section's own body is, and for the same reason — the HTML
      // reaches the customer's screen and the team's inbox.
      expect(service).toContain(
        `${field}: cleanBody(values.${field} ?? ctx.company.${companyField})`,
      );
    },
  );

  it.each(Object.entries(TEXTS))(
    "the form for a new quote starts on the company's %s",
    (field, companyField) => {
      // The template's copy wins when it has any; otherwise the company's. One
      // precedence for all four, so there is no fourth rule to remember.
      expect(newQuote).toContain(
        `${field}: fromTemplate?.${field} ?? ctx.company.${companyField}`,
      );
    },
  );

  it("each one can be saved from the settings screen", () => {
    const parsed = quoteSettingsSchema.safeParse({
      currency: "NZD",
      formatLocale: "en-NZ",
      timezone: "Pacific/Auckland",
      defaultLanguage: "EN_GB",
      defaultTaxType: "GST",
      defaultTaxRate: 15,
      taxDisplayMode: "TAX_EXCLUSIVE_INCLUSIVE_TOTAL",
      quotePrefix: "COT",
      quoteValidityDays: 30,
      quoteIntro: "Thank you for the opportunity.",
      quoteNotes: "Payment on completion.",
      quoteExclusions: "Scaffolding is not included.",
      quoteTerms: "Valid for 30 days from issue.",
      quoteScope: "General plastering and painting work.",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && Object.values(TEXTS).every((f) => f in parsed.data)).toBe(true);
  });
});
