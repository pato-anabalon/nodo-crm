import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The footer is HTML: sanitised on save and sent as HTML in every customer
 * email. It was edited in a plain `<textarea>`, which showed the stored tags
 * back as text — `<p>Referrals…<br />…</p>` — and anything typed around them
 * went out the same way. The settings page is a Server Component, so the
 * field it renders is asserted in its source.
 */
const page = readFileSync(
  join(process.cwd(), "src", "app", "s", "[slug]", "(app)", "settings", "emails", "page.tsx"),
  "utf8",
);

describe("the email footer", () => {
  it("is edited with the rich-text editor, like the quote's own texts", () => {
    expect(page).toMatch(/<RichAreaField\s+label=\{t\("shared\.footer"\)\}\s+name="quoteFooter"/);
  });

  it("is never a plain textarea again", () => {
    expect(page).not.toMatch(/<AreaField[^>]*name="quoteFooter"/);
  });
});
