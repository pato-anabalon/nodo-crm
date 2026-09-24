import {
  MAX_IMAGE_BYTES,
  checkBrandImage,
  isStoredImage,
  brandImagePathname,
} from "../brand-image";

describe("checkBrandImage", () => {
  const png = { type: "image/png", size: 40 * 1024, name: "logo.png" };

  it("accepts a PNG of reasonable size", () => {
    expect(checkBrandImage(png)).toEqual({ ok: true });
  });

  it.each(["image/jpeg", "image/webp"])("accepts %s too", (type) => {
    expect(checkBrandImage({ ...png, type })).toEqual({ ok: true });
  });

  it("rejects SVG, which can carry a script", () => {
    expect(checkBrandImage({ ...png, type: "image/svg+xml", name: "logo.svg" })).toEqual({
      ok: false,
      reason: "type",
    });
  });

  it("rejects a PDF renamed to look like an image", () => {
    expect(checkBrandImage({ ...png, type: "application/pdf" })).toEqual({ ok: false, reason: "type" });
  });

  it("rejects a file over the limit", () => {
    expect(checkBrandImage({ ...png, size: MAX_IMAGE_BYTES + 1 })).toEqual({ ok: false, reason: "size" });
  });

  it("rejects an empty upload", () => {
    expect(checkBrandImage({ ...png, size: 0 })).toEqual({ ok: false, reason: "empty" });
  });
});

describe("brandImagePathname", () => {
  it("files the logo under its company", () => {
    expect(brandImagePathname("cmp_1", "logo", "image/png")).toBe("companies/cmp_1/logo.png");
  });

  it("takes the extension from the type, not from the uploaded name", () => {
    expect(brandImagePathname("cmp_1", "watermark", "image/webp")).toBe("companies/cmp_1/watermark.webp");
    expect(brandImagePathname("cmp_1", "logo", "image/jpeg")).toBe("companies/cmp_1/logo.jpg");
  });
});

describe("isStoredImage", () => {
  it("recognises a file we uploaded", () => {
    expect(isStoredImage("https://abc123.public.blob.vercel-storage.com/companies/x/logo.png")).toBe(
      true,
    );
  });

  it("leaves a URL pointing at somebody else's server alone", () => {
    expect(isStoredImage("https://cdn.acme.co.nz/logo.png")).toBe(false);
  });

  it("is not fooled by the host appearing elsewhere in the URL", () => {
    expect(isStoredImage("https://evil.test/?x=.blob.vercel-storage.com")).toBe(false);
  });

  it("handles no logo and malformed values", () => {
    expect(isStoredImage(null)).toBe(false);
    expect(isStoredImage("not a url")).toBe(false);
  });
});

/**
 * Logo and watermark share every rule; only the name in the store differs.
 * Written as a pair because the whole point of the shared module is that a
 * second image can't quietly get its own, weaker, set of checks.
 */
describe("the two images are treated alike", () => {
  const png = { type: "image/png", size: 40 * 1024, name: "mark.png" };

  it.each(["logo", "watermark"] as const)("%s refuses an SVG", (kind) => {
    expect(brandImagePathname("cmp_1", kind, "image/png")).toBe(`companies/cmp_1/${kind}.png`);
    expect(checkBrandImage({ ...png, type: "image/svg+xml", name: "mark.svg" })).toEqual({
      ok: false,
      reason: "type",
    });
  });

  it("keeps the two in separate files, so one never overwrites the other", () => {
    expect(brandImagePathname("cmp_1", "logo", "image/png")).not.toBe(
      brandImagePathname("cmp_1", "watermark", "image/png"),
    );
  });

  it("puts both under the company's own folder", () => {
    for (const kind of ["logo", "watermark"] as const) {
      expect(brandImagePathname("cmp_1", kind, "image/webp").startsWith("companies/cmp_1/")).toBe(
        true,
      );
    }
  });
});
