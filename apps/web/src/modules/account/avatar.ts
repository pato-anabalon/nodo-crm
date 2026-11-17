import { extensionFor } from "@/modules/settings/brand-image";

/**
 * Where a user's own photo goes in the store — under their id rather than a
 * company's, since the same account can belong to several. Everything else
 * about it (accepted types, the size limit, the extension coming from the
 * content type, only deleting what we uploaded) is the same rule the
 * company's logo and watermark already follow, in `settings/brand-image.ts`.
 */
export function avatarPathname(userId: string, contentType: string): string {
  return `users/${userId}/avatar.${extensionFor(contentType)}`;
}
