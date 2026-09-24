import { renderTemplate } from "../render";

const values = { customer: "Paula Rivas", reference: "COT-000001", company: "Acme Ltd" };
const fallback = { subject: "Your quote", body: "Hello {{customer}},\nHere is your quote." };
const base = { fallback, values, reference: "COT-000001" };

describe("renderTemplate", () => {
  it("uses the platform's wording when the company saved nothing", () => {
    const out = renderTemplate({ ...base, stored: null });
    expect(out.subject).toBe("Your quote [COT-000001]");
    expect(out.bodyHtml).toContain("Hello Paula Rivas,");
  });

  it("prefers the company's wording", () => {
    const out = renderTemplate({
      ...base,
      stored: { subject: "Tu cotización de {{company}}", bodyHtml: "<p>Hola {{customer}}</p>" },
    });
    expect(out.subject).toBe("Tu cotización de Acme Ltd [COT-000001]");
    expect(out.bodyHtml).toContain("Hola Paula Rivas");
  });

  /**
   * Each of the two is something a person composed. Filling the gaps in one
   * with pieces of the other produces an email nobody wrote.
   */
  it("falls back per field, taking each one whole", () => {
    const out = renderTemplate({ ...base, stored: { subject: "Su presupuesto", bodyHtml: null } });
    expect(out.subject).toBe("Su presupuesto [COT-000001]");
    expect(out.bodyHtml).toContain("Hello Paula Rivas,");
  });

  it.each(["", "   ", null])("treats %p as nothing saved", (subject) => {
    const out = renderTemplate({ ...base, stored: { subject, bodyHtml: null } });
    expect(out.subject).toBe("Your quote [COT-000001]");
  });

  it("treats an empty editor as nothing saved, not as an empty email", () => {
    const out = renderTemplate({ ...base, stored: { subject: null, bodyHtml: "<p></p>" } });
    expect(out.bodyHtml).toContain("Hello Paula Rivas,");
  });

  it("keeps the line breaks of a default written as plain text", () => {
    const out = renderTemplate({ ...base, stored: null });
    expect(out.bodyHtml).toMatch(/<p>/);
  });

  /** It leaves for somebody else's inbox, so it is cleaned on the way out too. */
  it("strips anything the allowed list does not cover", () => {
    const out = renderTemplate({
      ...base,
      stored: { subject: null, bodyHtml: '<p>Hola<script>alert(1)</script><b>ahí</b></p>' },
    });
    expect(out.bodyHtml).not.toContain("script");
    expect(out.bodyHtml).toContain("<b>ahí</b>");
  });
});

/**
 * The reference has to be there, and exactly once. It is appended so that a
 * company who configures nothing still gets it, and skipped when they placed it
 * themselves — which one did, producing
 * "New Quote: Paula Rivas - COT-000007 [COT-000007]" in a real inbox.
 */
describe("renderTemplate: the reference appears once", () => {
  it("appends it when the subject doesn't mention it", () => {
    const out = renderTemplate({ ...base, stored: { subject: "Su presupuesto", bodyHtml: null } });
    expect(out.subject).toBe("Su presupuesto [COT-000001]");
  });

  it("leaves it alone when the company placed it themselves", () => {
    const out = renderTemplate({
      ...base,
      stored: { subject: "New Quote: {{customer}} - {{reference}}", bodyHtml: null },
    });
    expect(out.subject).toBe("New Quote: Paula Rivas - COT-000001");
  });

  it("does not append to a subject that already carries it in brackets", () => {
    const out = renderTemplate({ ...base, stored: { subject: "[{{reference}}] Presupuesto", bodyHtml: null } });
    expect(out.subject).toBe("[COT-000001] Presupuesto");
  });

  it("still appends to the platform's own subject", () => {
    expect(renderTemplate({ ...base, stored: null }).subject).toBe("Your quote [COT-000001]");
  });
});
