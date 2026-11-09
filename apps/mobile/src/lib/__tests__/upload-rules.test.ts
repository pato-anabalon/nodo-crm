import { blobPut, mediaName, pickedKind, planPhoto, storeIdOf, thumbnailName, thumbnailSize } from "../upload-rules";

const MB = 1024 * 1024;
const photo = (name: string, size: number, width = 4032, height = 3024) => ({
  name,
  mimeType: null,
  kind: "image" as const,
  size,
  width,
  height,
});

describe("pickedKind", () => {
  it("keeps a photo or a video from Files what it is, a HEIC included", () => {
    expect(pickedKind("IMG_0001.HEIC")).toBe("image");
    expect(pickedKind("site.png")).toBe("image");
    expect(pickedKind("walkthrough.mov")).toBe("video");
  });

  it("sends anything else as a document, for the server to accept or refuse", () => {
    expect(pickedKind("Plan A-101.pdf")).toBe("document");
    expect(pickedKind("quantities.xlsx")).toBe("document");
    expect(pickedKind("setup.exe")).toBe("document");
    expect(pickedKind("README")).toBe("document");
  });
});

describe("planPhoto", () => {
  it("brings a large JPEG down to 2560 on the long edge and keeps it JPEG", () => {
    expect(planPhoto(photo("IMG_0001.JPG", 6 * MB))).toEqual({
      reencode: true,
      format: "jpeg",
      name: "IMG_0001.JPG",
      resize: { width: 2560, height: 1920 },
    });
  });

  it("leaves a small photo alone", () => {
    expect(planPhoto(photo("small.jpg", 400_000, 1200, 900))).toMatchObject({ reencode: false, name: "small.jpg", resize: null });
  });

  it("turns a PNG into WebP, which keeps the transparency", () => {
    expect(planPhoto(photo("screen.png", 3 * MB, 1290, 2796))).toMatchObject({
      reencode: true,
      format: "webp",
      name: "screen.webp",
      resize: { width: 1181, height: 2560 },
    });
  });

  it("always draws a HEIC again, as a JPEG the store takes", () => {
    expect(planPhoto(photo("IMG_0002.HEIC", 900_000, 1000, 800))).toMatchObject({ reencode: true, format: "jpeg", name: "IMG_0002.jpg", resize: null });
  });
});

describe("names", () => {
  const now = new Date("2026-11-08T09:05:07Z");

  it("keeps the picker's name, and makes one from the type when the camera gave none", () => {
    expect(mediaName({ name: " IMG_1.MOV ", mimeType: "video/quicktime", kind: "video" }, now)).toBe("IMG_1.MOV");
    expect(mediaName({ name: null, mimeType: "image/jpeg", kind: "image" }, now)).toBe("photo-20261108-090507.jpg");
    expect(mediaName({ name: null, mimeType: "video/mp4", kind: "video" }, now)).toBe("video-20261108-090507.mp4");
    expect(mediaName({ name: null, mimeType: null, kind: "video" }, now)).toBe("video-20261108-090507.mov");
  });

  it("names the gallery copy after the photo, as a JPEG", () => {
    expect(thumbnailName("site.webp")).toBe("site.jpg");
    expect(thumbnailName("site")).toBe("site.jpg");
  });

  it("sizes the gallery copy to 480 on the long edge, or not at all when it is smaller", () => {
    expect(thumbnailSize(2560, 1920)).toEqual({ width: 480, height: 360 });
    expect(thumbnailSize(300, 200)).toBeNull();
  });
});

describe("blobPut", () => {
  const grant = {
    pathname: "companies/c1/jobs/j1/site photo.jpg",
    clientToken: "vercel_blob_client_AbCd123_eyJwYXlsb2FkIjoi",
    contentType: "image/jpeg",
  };

  it("reads the store from the client token", () => {
    expect(storeIdOf(grant.clientToken)).toBe("AbCd123");
  });

  it("puts to the store's API with the path, the token and the type the server chose", () => {
    const { url, headers } = blobPut(grant, 1234);
    expect(url).toBe("https://vercel.com/api/blob/?pathname=companies%2Fc1%2Fjobs%2Fj1%2Fsite%20photo.jpg");
    expect(headers).toMatchObject({
      authorization: `Bearer ${grant.clientToken}`,
      "x-api-version": "12",
      "x-vercel-blob-store-id": "AbCd123",
      "x-vercel-blob-access": "public",
      "x-content-type": "image/jpeg",
      "x-content-length": "1234",
      "x-add-random-suffix": "1",
    });
  });
});
