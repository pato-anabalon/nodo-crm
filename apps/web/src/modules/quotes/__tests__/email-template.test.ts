import { renderQuoteEmail, type QuoteEmailData } from "../email-template";

const labels: QuoteEmailData["labels"] = {
  greeting: "Hello Sarah,",
  intro: "Here's the quote you asked for:",
  itemsHeader: "Description",
  quantityHeader: "Qty",
  totalHeader: "Total",
  total: "Total: $13,800.00",
  validUntil: "Valid until 18 October 2026.",
  viewQuote: "View and respond to the quote",
};

const base: QuoteEmailData = {
  companyName: "Acme Ltd",
  primaryColor: "#14615e",
  contactName: "Sarah",
  reference: "COT-000001",
  title: "Office network quote",
  total: "$13,800.00",
  validUntil: "18 October 2026",
  lines: [{ description: "24-port switch", quantity: "3", total: "$13,500.00" }],
  sections: [],
  notesHtml: null,
  viewUrl: "https://acme.crm.nodo.co.nz/q/TOKEN",
  labels,
};

describe("renderQuoteEmail", () => {
  it("includes the reference, the title and the total", () => {
    const html = renderQuoteEmail(base);

    expect(html).toContain("COT-000001");
    expect(html).toContain("Office network quote");
    expect(html).toContain("Total: $13,800.00");
  });

  it("draws the line table in itemised mode", () => {
    const html = renderQuoteEmail(base);

    expect(html).toContain("24-port switch");
    expect(html).toContain("<table");
  });

  it("by sections it lists the blocks with their price", () => {
    const html = renderQuoteEmail({
      ...base,
      lines: [],
      sections: [
        { title: "Full mesh system plaster", amount: "$68,575.50", bodyHtml: "<p>Rockcote</p>" },
        { title: "HydroPlast waterproofing", amount: "$16,241.25", bodyHtml: null },
      ],
    });

    expect(html).toContain("Full mesh system plaster");
    expect(html).toContain("$16,241.25");
  });

  it("a section's sanitised HTML goes in without being escaped again", () => {
    const html = renderQuoteEmail({
      ...base,
      lines: [],
      sections: [{ title: "Plaster", amount: "$100", bodyHtml: "<p>Dos <strong>manos</strong></p>" }],
    });

    expect(html).toContain("<strong>manos</strong>");
    expect(html).not.toContain("&lt;strong&gt;");
  });

  it("a section title is escaped, because it is plain text", () => {
    const html = renderQuoteEmail({
      ...base,
      lines: [],
      sections: [{ title: '<script>x</script>', amount: "$100", bodyHtml: null }],
    });

    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("with neither lines nor sections it draws no table at all", () => {
    const html = renderQuoteEmail({ ...base, lines: [], sections: [] });
    expect(html).not.toContain("<table");
  });

  it("omits the greeting when there is no contact name", () => {
    const html = renderQuoteEmail({ ...base, contactName: null });
    expect(html).not.toContain("Hello Sarah,");
  });

  it("omits the validity when the quote has none", () => {
    const html = renderQuoteEmail({ ...base, validUntil: null });
    expect(html).not.toContain("Valid until");
  });

  it("escapes HTML coming from the quote's plain-text content", () => {
    const html = renderQuoteEmail({
      ...base,
      title: '<script>alert("xss")</script>',
      lines: [{ description: "<img src=x onerror=alert(1)>", quantity: "1", total: "$0.00" }],
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("the notes' sanitised HTML goes in without being escaped again", () => {
    const html = renderQuoteEmail({
      ...base,
      notesHtml: "<p>Rebaja del 5% por pago antes de <strong>7 días</strong></p>",
    });

    expect(html).toContain("<strong>7 días</strong>");
    expect(html).not.toContain("&lt;strong&gt;");
  });

  it("includes the button through to the customer portal", () => {
    const html = renderQuoteEmail(base);
    expect(html).toContain("https://acme.crm.nodo.co.nz/q/TOKEN");
    expect(html).toContain("View and respond to the quote");
  });

  it("omits the button when there is no new link to send", () => {
    const html = renderQuoteEmail({ ...base, viewUrl: null });
    expect(html).not.toContain("View and respond to the quote");
  });

  it("escapes the portal link", () => {
    const html = renderQuoteEmail({ ...base, viewUrl: 'https://x/q/T" onclick="evil()' });
    expect(html).not.toContain('onclick="evil()"');
    expect(html).toContain("&quot;");
  });

  it("escapes the brand colour too, since it comes from settings", () => {
    const html = renderQuoteEmail({ ...base, primaryColor: '#fff"><script>x</script>' });
    expect(html).not.toContain("<script>x</script>");
  });

  it("lets through no quotes that would break an attribute", () => {
    const html = renderQuoteEmail({ ...base, companyName: 'Acme " onmouseover="evil()' });
    expect(html).toContain("&quot;");
    expect(html).not.toContain('onmouseover="evil()');
  });
});
