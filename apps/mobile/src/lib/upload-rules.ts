import {
  extensionOf,
  fileRule,
  IMAGE_MAX_EDGE,
  JOB_FILE_RULES,
  renameForType,
  shouldCompress,
  THUMBNAIL_EDGE,
} from "@nodo/core/jobs/files";

/**
 * What a photo or a video becomes before it goes up, and the request that
 * puts it in the store. Pure, so the decisions — re-encode or not, which name,
 * which headers — are checked without a phone.
 *
 * The same rules as the web's uploader, from the same table: a photo comes
 * down to 2560 px on the long edge, JPEG stays JPEG and anything that may
 * carry transparency becomes WebP, a 480 px copy goes up beside it for the
 * galleries, and a video goes as it is.
 */

export type PickedMedia = {
  name: string | null;
  mimeType: string | null;
  kind: "image" | "video";
  size: number;
  width: number;
  height: number;
};

/** A name the server will accept: the picker's, or one made from the type when the camera gave none. */
export function mediaName(media: Pick<PickedMedia, "name" | "mimeType" | "kind">, now: Date): string {
  if (media.name?.trim()) return media.name.trim();
  const ext =
    Object.entries(JOB_FILE_RULES).find(([, rule]) => rule.contentType === media.mimeType)?.[0] ??
    (media.kind === "video" ? "mov" : "jpg");
  const stamp = now.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  return `${media.kind === "video" ? "video" : "photo"}-${stamp}.${ext}`;
}

/**
 * How a file chosen from Files is treated. A photo is still a photo — drawn
 * down and given its gallery copy, a HEIC turned into a JPEG — and a video
 * still goes as it is; everything else goes up untouched, and the server
 * decides whether the job takes it.
 */
export function pickedKind(name: string): "image" | "video" | "document" {
  const ext = extensionOf(name);
  if (ext === "heic" || ext === "heif") return "image";
  const kind = fileRule(name)?.kind;
  return kind === "image" || kind === "video" ? kind : "document";
}

export type PhotoPlan = {
  /** Whether it is drawn again — too big, or a format the store doesn't take (HEIC). */
  reencode: boolean;
  format: "jpeg" | "webp";
  /** The name it goes up with, its extension matching what it became. */
  name: string;
  /** The size to draw it at, or null to keep its own. */
  resize: { width: number; height: number } | null;
};

/** How a photo is prepared. A small JPEG is left alone; a HEIC is always drawn again, as JPEG. */
export function planPhoto(photo: PickedMedia & { name: string }): PhotoPlan {
  const rule = fileRule(photo.name);
  const transparent = rule?.contentType === "image/png" || rule?.contentType === "image/webp";
  const format = transparent ? "webp" : "jpeg";
  const reencode = !rule || shouldCompress(rule, photo);
  return {
    reencode,
    format,
    name: reencode ? renameForType(photo.name, `image/${format}`) : photo.name,
    resize: reencode ? fitWithin(photo.width, photo.height, IMAGE_MAX_EDGE) : null,
  };
}

/** The gallery copy's size, or null when the photo is already that small. */
export function thumbnailSize(width: number, height: number) {
  return fitWithin(width, height, THUMBNAIL_EDGE);
}

/** The gallery copy is a JPEG named after the photo; the server files it under `thumbnails/`. */
export function thumbnailName(name: string): string {
  const ext = extensionOf(name);
  return `${ext ? name.slice(0, -(ext.length + 1)) : name}.jpg`;
}

function fitWithin(width: number, height: number, edge: number): { width: number; height: number } | null {
  const long = Math.max(width, height);
  if (!long || long <= edge) return null;
  const scale = edge / long;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * What the server hands out for one file (`POST /jobs/<id>/uploads`): the
 * path it built and a client token the store holds to that path, type and cap.
 */
export type UploadGrant = { pathname: string; clientToken: string; contentType: string };

const BLOB_API = "https://vercel.com/api/blob";
/** The store's API version `@vercel/blob` 2.x speaks; the web's uploads go through the same one. */
const BLOB_API_VERSION = "12";

/**
 * The PUT `@vercel/blob`'s own `put()` makes, written out so the phone can
 * stream the file from disk instead of reading it into JavaScript — a site
 * video is hundreds of megabytes. The library itself leans on Node modules
 * React Native doesn't have.
 */
export function blobPut(grant: UploadGrant, size: number): { url: string; headers: Record<string, string> } {
  return {
    // Encoded by hand: React Native's URLSearchParams is only partly there.
    url: `${BLOB_API}/?pathname=${encodeURIComponent(grant.pathname)}`,
    headers: {
      authorization: `Bearer ${grant.clientToken}`,
      "x-api-version": BLOB_API_VERSION,
      "x-vercel-blob-store-id": storeIdOf(grant.clientToken),
      "x-vercel-blob-access": "public",
      "x-content-type": grant.contentType,
      "x-content-length": String(size),
      "x-add-random-suffix": "1",
    },
  };
}

/** `vercel_blob_client_<storeId>_<payload>` — where the library reads it from too. */
export function storeIdOf(clientToken: string): string {
  return clientToken.split("_")[3] ?? "";
}
