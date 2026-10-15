import {
  MAX_ATTACHMENTS_PER_QUOTE,
  MAX_ATTACHMENT_BYTES,
  attachmentPathname,
  checkAttachment,
  isAttachmentPathOf,
} from "../attachments";

const pdf = { type: "application/pdf", size: 2048, name: "markups.pdf" };

describe("checkAttachment", () => {
  it("accepts PDFs and images", () => {
    expect(checkAttachment(pdf, 0)).toEqual({ ok: true });
    expect(checkAttachment({ ...pdf, type: "image/jpeg", name: "sitio.jpg" }, 0)).toEqual({ ok: true });
  });

  it("rejects other formats", () => {
    expect(checkAttachment({ ...pdf, type: "application/zip", name: "x.zip" }, 0)).toEqual({
      ok: false,
      reason: "type",
    });
  });

  it("rejects anything over the size limit", () => {
    expect(checkAttachment({ ...pdf, size: MAX_ATTACHMENT_BYTES + 1 }, 0).ok).toBe(false);
    expect(checkAttachment({ ...pdf, size: MAX_ATTACHMENT_BYTES }, 0).ok).toBe(true);
  });

  it("cuts off on reaching the per-quote maximum", () => {
    expect(checkAttachment(pdf, MAX_ATTACHMENTS_PER_QUOTE)).toEqual({ ok: false, reason: "too-many" });
    expect(checkAttachment(pdf, MAX_ATTACHMENTS_PER_QUOTE - 1).ok).toBe(true);
  });

  it("rejects an empty file", () => {
    expect(checkAttachment({ ...pdf, size: 0 }, 0)).toEqual({ ok: false, reason: "empty" });
  });
});

describe("attachmentPathname", () => {
  it("stores it under the company and the quote", () => {
    expect(attachmentPathname("cmp_1", "q_1", "markups.pdf")).toBe(
      "companies/cmp_1/quotes/q_1/markups.pdf",
    );
  });

  it("cleans up accents and spaces", () => {
    expect(attachmentPathname("cmp_1", "q_1", "Plano de fachada.pdf")).toBe(
      "companies/cmp_1/quotes/q_1/Plano-de-fachada.pdf",
    );
  });

  it("does not let the name escape the directory", () => {
    const path = attachmentPathname("cmp_1", "q_1", "../../otra/secreto.pdf");
    expect(path.startsWith("companies/cmp_1/quotes/q_1/")).toBe(true);
    expect(path).not.toContain("..");
  });
});

describe("isAttachmentPathOf", () => {
  it("accepts what an upload to this quote produces, random suffix included", () => {
    const path = attachmentPathname("cmp_1", "q_1", "26 Pacific Cliffs Drive - Markups.pdf");
    expect(isAttachmentPathOf("cmp_1", "q_1", path)).toBe(true);
    expect(
      isAttachmentPathOf("cmp_1", "q_1", path.replace(/\.pdf$/, "-Xk3pQ9aZ7bL2mN4vR8sT1uW5yC0dEf.pdf")),
    ).toBe(true);
  });

  it("refuses another company's file", () => {
    expect(isAttachmentPathOf("cmp_1", "q_1", "companies/cmp_2/quotes/q_1/markups.pdf")).toBe(false);
  });

  it("refuses another quote's file in the same company", () => {
    expect(isAttachmentPathOf("cmp_1", "q_1", "companies/cmp_1/quotes/q_2/markups.pdf")).toBe(false);
  });

  it("refuses a quote whose id merely starts the same", () => {
    expect(isAttachmentPathOf("cmp_1", "q_1", "companies/cmp_1/quotes/q_10/markups.pdf")).toBe(false);
  });

  it("refuses anything that climbs out or reaches deeper", () => {
    expect(isAttachmentPathOf("cmp_1", "q_1", "companies/cmp_1/quotes/q_1/../q_2/x.pdf")).toBe(false);
    expect(isAttachmentPathOf("cmp_1", "q_1", "companies/cmp_1/quotes/q_1/sub/x.pdf")).toBe(false);
    expect(isAttachmentPathOf("cmp_1", "q_1", "companies/cmp_1/logo.png")).toBe(false);
  });

  it("refuses the bare folder and a full URL", () => {
    expect(isAttachmentPathOf("cmp_1", "q_1", "companies/cmp_1/quotes/q_1/")).toBe(false);
    expect(
      isAttachmentPathOf("cmp_1", "q_1", "https://evil.example/companies/cmp_1/quotes/q_1/x.pdf"),
    ).toBe(false);
  });
});
