import { renderCustomerEmail, type CustomerEmailData } from "../customer-email";

const base: CustomerEmailData = {
  bodyHtml: "<p>Your quote is ready.</p>",
  primaryColor: "#2563eb",
  companyName: "PlasterPro Solution",
  logoUrl: "https://blob.example/companies/abc/logo.png",
  slogan: null,
  validUntilLabel: null,
  cta: { label: "View quote", url: "https://acme.example/q/token" },
  footerHtml: null,
};

describe("the email the customer gets", () => {
  it("shows the logo above the brand rule", () => {
    const html = renderCustomerEmail(base);

    expect(html).toContain(base.logoUrl!);
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("border-top:4px solid"));
  });

  it("sizes the logo for Outlook and for everything else", () => {
    const html = renderCustomerEmail(base);

    // Outlook reads the attribute; the rest read the inline style. `height:auto`
    // is what keeps the proportions whichever of them wins.
    expect(html).toContain('width="140"');
    expect(html).toContain("width:140px");
    expect(html).toContain("height:auto");
  });

  it("names the company in the alt text, for the client that blocks images", () => {
    expect(renderCustomerEmail(base)).toContain('alt="PlasterPro Solution"');
  });

  it("leaves the logo out entirely when there is none", () => {
    const html = renderCustomerEmail({ ...base, logoUrl: null });

    expect(html).not.toContain("<img");
    expect(html).toContain("border-top:4px solid");
  });

  it("escapes the address rather than pasting it into the attribute", () => {
    const html = renderCustomerEmail({
      ...base,
      logoUrl: 'https://blob.example/a.png" onerror="alert(1)',
    });

    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain("&quot;");
  });

  /** Still true after the logo: the link is the only source of the figures. */
  it("carries no prices", () => {
    const html = renderCustomerEmail(base);
    expect(html).not.toMatch(/\$|\btotal\b/i);
  });
});
