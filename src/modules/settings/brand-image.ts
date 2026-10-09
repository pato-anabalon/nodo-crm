/**
 * The two images a company uploads: its logo and its watermark.
 *
 * Both are raster only, both live under the company's own folder, and both are
 * shown to the end customer — so they share these rules rather than each
 * carrying its own copy of them.
 */

/**
 * Raster formats only.
 *
 * SVG is deliberately out: it can carry a script, and these are rendered for
 * the end customer in the portal. The file would be served from the blob host
 * rather than the company's subdomain, so the damage is bounded — but nothing
 * about a logo or a watermark needs a scriptable format, and this is the
 * cheapest moment to say no.
 */
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** 2 MB. Above that it is a photograph someone uploaded by mistake. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** The two, named once so a typo can't invent a third folder. */
export const BRAND_IMAGES = ["logo", "watermark"] as const;
export type BrandImage = (typeof BRAND_IMAGES)[number];

export type ImageCheck = { ok: true } | { ok: false; reason: "type" | "size" | "empty" };

/** Validates the file before uploading. Pure, so it can be tested without a network. */
export function checkBrandImage(file: { type: string; size: number; name: string }): ImageCheck {
  if (!file.name || file.size === 0) return { ok: false, reason: "empty" };
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return { ok: false, reason: "type" };
  }
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}

/**
 * The extension the stored file gets, taken from the type rather than the
 * name. Exported so a third image living outside this module — a user's
 * avatar, under `users/<id>/` rather than `companies/<id>/` — gets its
 * extension the same way instead of a second copy of this.
 */
export function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

/**
 * Where the file goes inside the store.
 *
 * Under the company id, like every other file: one company's uploads never
 * cross with another's, not even in storage. The name comes from `kind` rather
 * than from the upload — there is only ever one of each, and the original
 * filename is noise that would otherwise have to be sanitised.
 */
export function brandImagePathname(
  companyId: string,
  kind: BrandImage,
  contentType: string,
): string {
  return `companies/${companyId}/${kind}.${extensionFor(contentType)}`;
}

/**
 * Is this a file we uploaded, or a URL someone pasted before?
 *
 * Only ours may be deleted from the store. A company that pointed `logoUrl` at
 * its own CDN keeps working, and replacing it must not try to delete a file on
 * somebody else's server.
 */
export function isStoredImage(url: string | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}
