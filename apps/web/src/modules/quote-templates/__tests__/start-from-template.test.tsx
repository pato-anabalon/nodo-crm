import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { QuoteForm } from "@/modules/quotes/quote-form";

/**
 * Picking a template is `router.push` to the same `/quotes/new` route, which
 * re-renders the form instead of mounting it again. The lines, the sections
 * and the pricing mode live in `useState`, and the rich-text editors read
 * their content once — so without a key that changes with the template, only
 * the plain inputs followed and a template looked like it carried a title and
 * nothing else.
 *
 * The page is a Server Component, so the key is asserted in its source; the
 * render below checks that a form *mounted* with a template's defaults does
 * show what the template carries.
 */
const newQuotePage = readFileSync(
  join(process.cwd(), "src", "app", "s", "[slug]", "(app)", "quotes", "new", "page.tsx"),
  "utf8",
);

describe("starting a quote from a template", () => {
  it("remounts the form whenever the template changes", () => {
    expect(newQuotePage).toMatch(/<QuoteForm\s+key=\{fromTemplate \? template : "blank"\}/);
  });

  it("fills in the template's sections, not just its title", () => {
    renderWithIntl(
      <QuoteForm
        action={jest.fn(async () => ({}))}
        searchLeads={async () => []}
        searchCatalogue={async () => []}
        documents={[]}
        currency="NZD"
        currencies={[{ value: "NZD", label: "NZD — New Zealand Dollar" }]}
        formatLocale="en-NZ"
        taxDisplayMode="TAX_EXCLUSIVE_INCLUSIVE_TOTAL"
        taxLabel="GST"
        submitLabel="Create quote"
        defaults={{
          title: "Rockcote full replaster",
          pricingMode: "SECTIONS",
          sections: [
            { title: "Strip and prepare", body: "<p>Remove old render</p>", amount: "1200", kind: "INDEPENDENT" },
            { title: "Waterproof coating", body: "", amount: "800", kind: "OPTIONAL" },
          ],
        }}
      />,
    );

    expect(screen.getByLabelText("Title")).toHaveValue("Rockcote full replaster");
    expect(screen.getByDisplayValue("Strip and prepare")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Waterproof coating")).toBeInTheDocument();
  });
});
