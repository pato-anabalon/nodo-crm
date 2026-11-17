import {
  MAX_DOCUMENT_BYTES,
  checkDocument,
  documentPathname,
  formatBytes,
} from "../constants";

describe("checkDocument", () => {
  const pdf = { type: "application/pdf", size: 1024, name: "terms.pdf" };

  it("accepts a PDF of reasonable size", () => {
    expect(checkDocument(pdf)).toEqual({ ok: true });
  });

  it("rejects anything that is not a PDF", () => {
    expect(checkDocument({ ...pdf, type: "image/png", name: "logo.png" })).toEqual({
      ok: false,
      reason: "type",
    });
  });

  it("rejects a file over the limit", () => {
    expect(checkDocument({ ...pdf, size: MAX_DOCUMENT_BYTES + 1 })).toEqual({
      ok: false,
      reason: "size",
    });
  });

  it("accepts exactly the limit", () => {
    expect(checkDocument({ ...pdf, size: MAX_DOCUMENT_BYTES })).toEqual({ ok: true });
  });

  it("rejects a file that is empty or unnamed", () => {
    expect(checkDocument({ ...pdf, size: 0 })).toEqual({ ok: false, reason: "empty" });
    expect(checkDocument({ ...pdf, name: "" })).toEqual({ ok: false, reason: "empty" });
  });
});

describe("documentPathname", () => {
  it("stores each document under its company", () => {
    expect(documentPathname("cmp_1", "terms.pdf")).toBe("companies/cmp_1/terms/terms.pdf");
  });

  it("cleans accents and spaces out of the name", () => {
    expect(documentPathname("cmp_1", "Términos y condiciones.pdf")).toBe(
      "companies/cmp_1/terms/Terminos-y-condiciones.pdf",
    );
  });

  it("does not let the name escape the company's directory", () => {
    const path = documentPathname("cmp_1", "../../otra-empresa/secreto.pdf");
    expect(path.startsWith("companies/cmp_1/terms/")).toBe(true);
    expect(path).not.toContain("..");
  });

  it("uses a default name when nothing usable is left", () => {
    expect(documentPathname("cmp_1", "///")).toBe("companies/cmp_1/terms/document.pdf");
  });
});

describe("formatBytes", () => {
  it("scales to the readable unit", () => {
    expect(formatBytes(512, "en-NZ")).toBe("512 B");
    expect(formatBytes(2048, "en-NZ")).toBe("2 KB");
    expect(formatBytes(1024 * 1024 * 1.5, "en-NZ")).toBe("1.5 MB");
  });
});
