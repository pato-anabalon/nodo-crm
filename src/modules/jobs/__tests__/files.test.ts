import {
  checkJobFile,
  compressedType,
  fileRule,
  isBlobUrlFor,
  isUnderPrefix,
  JOB_FILE_ACCEPT,
  JOB_FILE_RULES,
  jobFilePathname,
  jobUploadPrefix,
  matchesFilter,
  MAX_SOURCE_IMAGE_BYTES,
  renameForType,
  shouldCompress,
  THUMBNAIL_MAX_BYTES,
  uploadAllowance,
} from "../files";

const MB = 1024 * 1024;
const prefix = jobUploadPrefix("company1", "job1");

describe("checkJobFile", () => {
  it("accepts a phone photo well over the stored ceiling, because it will be compressed", () => {
    const result = checkJobFile({ name: "IMG_0001.JPG", size: 30 * MB });
    expect(result).toEqual({ ok: true, rule: JOB_FILE_RULES.jpg });
  });

  it("refuses a photo beyond what a browser can sensibly decode", () => {
    expect(checkJobFile({ name: "huge.png", size: MAX_SOURCE_IMAGE_BYTES + 1 })).toEqual({ ok: false, reason: "size" });
  });

  it("holds a video to its own cap", () => {
    expect(checkJobFile({ name: "walkthrough.mov", size: 400 * MB }).ok).toBe(true);
    expect(checkJobFile({ name: "walkthrough.mov", size: 501 * MB })).toEqual({ ok: false, reason: "size" });
  });

  it("takes a 99 MB plan", () => {
    expect(checkJobFile({ name: "Plans rev C.pdf", size: 99 * MB }).ok).toBe(true);
  });

  it("names HEIC apart from an unknown type", () => {
    expect(checkJobFile({ name: "IMG_0002.HEIC", size: MB })).toEqual({ ok: false, reason: "heic" });
    expect(checkJobFile({ name: "setup.exe", size: MB })).toEqual({ ok: false, reason: "type" });
    expect(checkJobFile({ name: "no-extension", size: MB })).toEqual({ ok: false, reason: "type" });
  });

  it("refuses archives, which can carry anything, and GIFs, which a job has no use for", () => {
    for (const name of ["plans.zip", "loop.gif", "installer.dmg", "data.json"]) {
      expect(checkJobFile({ name, size: MB })).toEqual({ ok: false, reason: "type" });
    }
  });

  it("refuses an empty file", () => {
    expect(checkJobFile({ name: "a.pdf", size: 0 })).toEqual({ ok: false, reason: "empty" });
  });
});

describe("shouldCompress", () => {
  const jpg = JOB_FILE_RULES.jpg;

  it("leaves a small photo within the edge alone", () => {
    expect(shouldCompress(jpg, { size: MB, width: 1920, height: 1080 })).toBe(false);
  });

  it("compresses a heavy photo or one larger than any screen", () => {
    expect(shouldCompress(jpg, { size: 6 * MB, width: 1920, height: 1080 })).toBe(true);
    expect(shouldCompress(jpg, { size: MB, width: 4032, height: 3024 })).toBe(true);
  });

});

describe("compressed format", () => {
  it("keeps JPEG and turns PNG into WebP so transparency survives", () => {
    expect(compressedType("image/jpeg")).toBe("image/jpeg");
    expect(compressedType("image/png")).toBe("image/webp");
  });

  it("renames the file to match what is stored", () => {
    expect(renameForType("screenshot.png", "image/webp")).toBe("screenshot.webp");
    expect(renameForType("IMG_1.JPG", "image/jpeg")).toBe("IMG_1.JPG");
    expect(renameForType("photo.jpeg", "image/jpeg")).toBe("photo.jpeg");
  });
});

describe("paths", () => {
  it("puts every file under the company and the job", () => {
    expect(jobFilePathname(prefix, "Plano Ñuñoa (rev 2).pdf")).toBe(
      "companies/company1/jobs/job1/Plano-Nunoa-rev-2.pdf",
    );
    expect(jobFilePathname(prefix, "IMG_1.jpg", "thumbnail")).toBe("companies/company1/jobs/job1/thumbnails/IMG_1.jpg");
  });

  it("refuses anything that climbs out of the job", () => {
    expect(isUnderPrefix(`${prefix}a.pdf`, prefix)).toBe(true);
    expect(isUnderPrefix(`${prefix}../job2/a.pdf`, prefix)).toBe(false);
    expect(isUnderPrefix("companies/company1/jobs/job2/a.pdf", prefix)).toBe(false);
    expect(isUnderPrefix(`${prefix}`, prefix)).toBe(false);
    expect(isUnderPrefix(`${prefix}/a.pdf`, prefix)).toBe(false);
  });
});

describe("uploadAllowance", () => {
  it("allows exactly the table's type and cap", () => {
    expect(uploadAllowance(`${prefix}plan.pdf`, prefix)).toEqual({
      allowedContentTypes: ["application/pdf"],
      maximumSizeInBytes: JOB_FILE_RULES.pdf.maxBytes,
    });
  });

  it("caps thumbnails tightly and only allows images there", () => {
    expect(uploadAllowance(`${prefix}thumbnails/a.webp`, prefix)?.maximumSizeInBytes).toBe(THUMBNAIL_MAX_BYTES);
    expect(uploadAllowance(`${prefix}thumbnails/a.pdf`, prefix)).toBeNull();
  });

  it("refuses an unknown type or a foreign path", () => {
    expect(uploadAllowance(`${prefix}run.sh`, prefix)).toBeNull();
    expect(uploadAllowance("companies/other/jobs/job1/a.pdf", prefix)).toBeNull();
  });
});

describe("isBlobUrlFor", () => {
  const pathname = `${prefix}plan-AbC123.pdf`;

  it("accepts the store's URL for that exact path", () => {
    expect(isBlobUrlFor(`https://xyz.public.blob.vercel-storage.com/${pathname}`, pathname)).toBe(true);
  });

  it("refuses another host, another path or plain http", () => {
    expect(isBlobUrlFor(`https://evil.example.com/${pathname}`, pathname)).toBe(false);
    expect(isBlobUrlFor(`https://xyz.public.blob.vercel-storage.com/${prefix}other.pdf`, pathname)).toBe(false);
    expect(isBlobUrlFor(`http://xyz.public.blob.vercel-storage.com/${pathname}`, pathname)).toBe(false);
    expect(isBlobUrlFor("not a url", pathname)).toBe(false);
  });
});

describe("filters", () => {
  it("reads a drawing as a document even though its type says image", () => {
    expect(fileRule("site.dwg")?.contentType).toBe("image/vnd.dwg");
    expect(matchesFilter("image/vnd.dwg", "documents")).toBe(true);
    expect(matchesFilter("image/vnd.dwg", "images")).toBe(false);
    expect(matchesFilter("video/mp4", "videos")).toBe(true);
    expect(matchesFilter("application/pdf", null)).toBe(true);
  });

  it("lists the image types in accept, which is what makes iOS convert HEIC", () => {
    expect(JOB_FILE_ACCEPT).toContain("image/jpeg");
    expect(JOB_FILE_ACCEPT).toContain(".pdf");
    expect(JOB_FILE_ACCEPT).not.toContain("heic");
  });
});
