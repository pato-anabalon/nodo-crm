import {
  MAX_LEAD_ATTACHMENTS,
  attachmentContentType,
  extractAttachments,
  isAttachmentKey,
  leadAttachmentPathname,
} from "../attachments";

const MB = 1024 * 1024;
const blob = (name: string) => `https://store.public.blob.vercel-storage.com/quote-requests/${name}`;

describe("extractAttachments", () => {
  it("reads the list a website form sends", () => {
    const { accepted, rejected } = extractAttachments({
      email: "a@b.nz",
      files: [
        { name: "file-1.jpg", size: 2 * MB, type: "image/jpeg", url: blob("file-1.jpg") },
        { name: "file-2.pdf", size: MB, type: "application/pdf", url: blob("file-2.pdf") },
      ],
    });

    expect(rejected).toEqual([]);
    expect(accepted).toEqual([
      { name: "file-1.jpg", size: 2 * MB, contentType: "image/jpeg", sourceUrl: blob("file-1.jpg") },
      { name: "file-2.pdf", size: MB, contentType: "application/pdf", sourceUrl: blob("file-2.pdf") },
    ]);
  });

  it("accepts plain URL strings under `attachments`", () => {
    const { accepted } = extractAttachments({ attachments: [blob("site.png")] });
    expect(accepted).toEqual([
      { name: "site.png", size: null, contentType: null, sourceUrl: blob("site.png") },
    ]);
  });

  it("returns nothing when the form sent no files", () => {
    expect(extractAttachments({ name: "Paula" })).toEqual({ accepted: [], rejected: [] });
    expect(extractAttachments({ files: "not-a-list" })).toEqual({ accepted: [], rejected: [] });
  });

  it("drops links that are not https", () => {
    const { accepted, rejected } = extractAttachments({
      files: [{ name: "a.jpg", url: "http://example.com/a.jpg" }],
    });
    expect(accepted).toEqual([]);
    expect(rejected).toHaveLength(1);
  });

  it("drops types that are not allowed", () => {
    const { accepted, rejected } = extractAttachments({
      files: [
        { name: "macro.docm", url: blob("macro.docm") },
        { name: "photo.jpg", type: "text/html", url: blob("photo.jpg") },
      ],
    });
    expect(accepted).toEqual([]);
    expect(rejected).toHaveLength(2);
  });

  it("enforces the per-file, total and count limits", () => {
    const big = extractAttachments({
      files: [{ name: "big.pdf", size: 10 * MB + 1, url: blob("big.pdf") }],
    });
    expect(big.accepted).toEqual([]);

    const total = extractAttachments({
      files: [1, 2, 3].map((n) => ({ name: `f${n}.pdf`, size: 9 * MB, url: blob(`f${n}.pdf`) })),
    });
    expect(total.accepted).toHaveLength(2);
    expect(total.rejected).toHaveLength(1);

    const many = extractAttachments({
      files: Array.from({ length: MAX_LEAD_ATTACHMENTS + 2 }, (_, n) => blob(`f${n}.png`)),
    });
    expect(many.accepted).toHaveLength(MAX_LEAD_ATTACHMENTS);
    expect(many.rejected).toHaveLength(2);
  });

  it("skips unreadable entries without failing the rest", () => {
    const { accepted, rejected } = extractAttachments({
      files: [null, 42, { name: "no-url.pdf" }, blob("ok.pdf")],
    });
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(3);
  });
});

describe("attachmentContentType", () => {
  it("lets the extension decide when no type was declared", () => {
    expect(attachmentContentType("IMG_0001.HEIC", null)).toBe("image/heic");
    expect(attachmentContentType("plan.pdf", "application/octet-stream")).toBe("application/pdf");
  });

  it("treats heic and heif as one family", () => {
    expect(attachmentContentType("photo.heic", "image/heif")).toBe("image/heif");
  });

  it("refuses a declared type that contradicts the extension", () => {
    expect(attachmentContentType("photo.jpg", "application/pdf")).toBeNull();
    expect(attachmentContentType("script.svg", "image/svg+xml")).toBeNull();
  });
});

describe("isAttachmentKey", () => {
  it("recognises the keys files arrive under", () => {
    expect(isAttachmentKey("files")).toBe(true);
    expect(isAttachmentKey("Attachments")).toBe(true);
    expect(isAttachmentKey("message")).toBe(false);
  });
});

describe("leadAttachmentPathname", () => {
  it("keeps the file under the company and the lead, with a safe name", () => {
    expect(leadAttachmentPathname("c1", "l1", "../../Fotos baño.JPG")).toBe(
      "companies/c1/leads/l1/Fotos-bano.JPG",
    );
    expect(leadAttachmentPathname("c1", "l1", "...")).toBe("companies/c1/leads/l1/attachment");
  });
});
