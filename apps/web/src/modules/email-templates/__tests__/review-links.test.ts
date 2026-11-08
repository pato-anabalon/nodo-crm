import { EmailTemplateKind } from "@/generated/prisma/enums";
import { emailTemplateSchema } from "../schemas";
import { withReviewLinks } from "../review-links";

const links = [
  { name: "Google", url: "https://g.page/r/abc" },
  { name: "A & B", url: "https://example.com/?a=1&b=2" },
];
const REVIEW = EmailTemplateKind.REVIEW_REQUEST;

describe("withReviewLinks", () => {
  it("puts the list where the field is, replacing a paragraph that holds only it", () => {
    const html = withReviewLinks("<p>Thanks</p><p>{{reviewLinks}}</p><p>Kind regards</p>", REVIEW, links);
    expect(html.indexOf("Thanks")).toBeLessThan(html.indexOf("<ul"));
    expect(html.indexOf("<ul")).toBeLessThan(html.indexOf("Kind regards"));
    expect(html).not.toContain("{{");
    expect(html).not.toContain("<p><ul");
  });

  it("appends the list when the field is left out, so the links are never lost", () => {
    const html = withReviewLinks("<p>Thanks</p>", REVIEW, links);
    expect(html.startsWith("<p>Thanks</p><ul")).toBe(true);
  });

  it("escapes names and addresses", () => {
    const html = withReviewLinks("<p>x</p>", REVIEW, links);
    expect(html).toContain("A &amp; B");
    expect(html).toContain("a=1&amp;b=2");
  });

  it("leaves other emails alone", () => {
    expect(withReviewLinks("<p>x</p>", EmailTemplateKind.NEW_QUOTE, links)).toBe("<p>x</p>");
  });
});

describe("the reviewLinks field on save", () => {
  const form = (kind: EmailTemplateKind, field: "subject" | "bodyHtml") => ({
    kind,
    subject: "",
    bodyHtml: "",
    enabled: true,
    [field]: "{{reviewLinks}}",
  });

  it("is accepted in the review request's body", () => {
    expect(emailTemplateSchema.safeParse(form(REVIEW, "bodyHtml")).success).toBe(true);
  });

  it("is refused in its subject and in any other email", () => {
    expect(emailTemplateSchema.safeParse(form(REVIEW, "subject")).success).toBe(false);
    expect(emailTemplateSchema.safeParse(form(EmailTemplateKind.NEW_QUOTE, "bodyHtml")).success).toBe(false);
  });
});
