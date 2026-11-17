import { MAX_LEAD_FILES, checkLeadFile, isLeadFilePathOf, leadFilePathname } from "../files";

const photo = { name: "wall.jpg", type: "image/jpeg", size: 2_000_000 };

describe("checkLeadFile", () => {
  it("accepts a photo", () => {
    expect(checkLeadFile(photo, 0)).toEqual({ ok: true });
  });

  it("refuses types the store shouldn't hold for a customer's lead", () => {
    expect(checkLeadFile({ ...photo, type: "image/svg+xml" }, 0)).toEqual({ ok: false, reason: "type" });
  });

  it("refuses a file over the size cap and an empty one", () => {
    expect(checkLeadFile({ ...photo, size: 21 * 1024 * 1024 }, 0)).toEqual({ ok: false, reason: "size" });
    expect(checkLeadFile({ ...photo, size: 0 }, 0)).toEqual({ ok: false, reason: "empty" });
  });

  it("has its own cap, not the quote's ten", () => {
    expect(checkLeadFile(photo, 10)).toEqual({ ok: true });
    expect(checkLeadFile(photo, MAX_LEAD_FILES)).toEqual({ ok: false, reason: "too-many" });
  });
});

describe("isLeadFilePathOf", () => {
  it("accepts what this lead's own upload produces", () => {
    expect(isLeadFilePathOf("c1", "l1", leadFilePathname("c1", "l1", "Fotos baño.JPG"))).toBe(true);
  });

  it("refuses another lead's, another company's, and traversal", () => {
    expect(isLeadFilePathOf("c1", "l1", "companies/c1/leads/l2/a.jpg")).toBe(false);
    expect(isLeadFilePathOf("c1", "l1", "companies/c2/leads/l1/a.jpg")).toBe(false);
    expect(isLeadFilePathOf("c1", "l1", "companies/c1/leads/l1/../l2/a.jpg")).toBe(false);
    expect(isLeadFilePathOf("c1", "l1", "companies/c1/leads/l1/sub/a.jpg")).toBe(false);
  });
});
