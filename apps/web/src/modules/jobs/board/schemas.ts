import { z } from "zod";
import { isRichTextEmpty, sanitizeRichText } from "@/lib/rich-text";
import type { UploadedFile } from "../files-service";

/**
 * Sanitised on the way in with the Message Board's profile: what is stored is
 * already what may be shown. `RichText` sanitises again on the way out.
 */
const body = z
  .string()
  .max(200_000)
  .transform((html) => sanitizeRichText(html, "full"))
  .transform((html) => (isRichTextEmpty(html) ? "" : html));

export const postSchema = z.object({
  title: z.string().trim().min(1, "validation.required").max(200),
  body,
  categoryId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export type PostValues = z.infer<typeof postSchema>;

export const commentSchema = z.object({ body });

/**
 * Who hears about a post going out. Basecamp's three: everybody following the
 * job, the people the author ticks, or nobody — a correction to yesterday's
 * report doesn't need to buzz eleven phones.
 */
export const NOTIFY_MODES = ["followers", "selected", "nobody"] as const;
export type NotifyMode = (typeof NOTIFY_MODES)[number];

export function notifyModeFrom(value: FormDataEntryValue | null): NotifyMode {
  return NOTIFY_MODES.includes(value as NotifyMode) ? (value as NotifyMode) : "followers";
}

const uploadSchema = z.object({
  url: z.string().max(2000),
  pathname: z.string().max(1000),
  name: z.string().max(255),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  thumbnail: z.object({ url: z.string().max(2000), pathname: z.string().max(1000) }).nullable(),
});

/** How many files one post or comment may carry: a day's photos, not an archive. */
export const MAX_ATTACHMENTS = 40;

/**
 * The files an attachment field posts, as JSON in one hidden input. Shape only:
 * whether each really is this job's stored file is `verifyUploads`' question.
 * Anything malformed reads as nothing rather than as an error — the field is
 * written by our own component, so a bad value is a forged one.
 */
export function parseUploads(raw: FormDataEntryValue | null): UploadedFile[] {
  if (typeof raw !== "string" || raw === "") return [];
  try {
    const parsed = z.array(uploadSchema).max(MAX_ATTACHMENTS).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Ids posted by checkboxes or repeated hidden fields. */
export function idsFrom(values: FormDataEntryValue[]): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === "string" && v !== ""))];
}

export const postCategorySchema = z.object({
  // One emoji, which can be several code points (a flag, a skin tone, ❤️).
  emoji: z.string().trim().min(1, "validation.required").max(16),
  name: z.string().trim().min(1, "validation.required").max(40),
});
