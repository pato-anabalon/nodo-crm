import { z } from "zod";
import { uploadsSchema } from "@/modules/jobs/board/schemas";

/**
 * What the app posts. To-do notes and comments are **plain text**: rich text
 * is written on the web, and an editor on a phone is a cost v1 doesn't pay.
 * They become HTML on the server, through the same schemas the web saves with.
 */

const day = z.string().nullable().optional();
const ids = z.array(z.string().min(1).max(64)).max(200);

export const todoCreateSchema = z.object({
  title: z.string(),
  notes: z.string().max(20_000).optional(),
  startsOn: day,
  dueOn: day,
  assigneeIds: ids.optional(),
  uploads: uploadsSchema.optional(),
});

/**
 * Only what is sent changes. Notes left out keep what the web wrote, which is
 * how a person fixing a date from the phone doesn't flatten a formatted list.
 */
export const todoUpdateSchema = z.object({
  title: z.string().optional(),
  notes: z.string().max(20_000).optional(),
  startsOn: day,
  dueOn: day,
  listId: z.string().min(1).max(64).optional(),
  assigneeIds: ids.optional(),
  /** Added to what the to-do already carries. */
  uploads: uploadsSchema.optional(),
  /** Taken off it; only ids that really are its own count. */
  removeFileIds: ids.optional(),
});

/** A to-do list: a stage of the work. The description is plain text, like a to-do's notes. */
export const todoListCreateSchema = z.object({
  name: z.string(),
  description: z.string().max(20_000).optional(),
});

/** Only what is sent changes, so renaming from the phone keeps a description formatted on the web. */
export const todoListUpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().max(20_000).optional(),
});

export const completionSchema = z.object({ done: z.boolean() });

/** A comment or a chat message: text, files, or both. */
export const textSchema = z.object({ body: z.string().max(20_000).default(""), uploads: uploadsSchema.optional() });

/**
 * Asking to upload one file. The server builds the path from the name, under
 * this job's prefix; `size` is what the file weighs as it will be sent (after
 * the phone compressed it), so a refusal comes before the bytes go anywhere.
 * The store enforces the same cap on the upload itself.
 */
export const uploadTokenSchema = z.object({
  name: z.string().trim().min(1, "validation.required").max(255),
  size: z.number().int().positive(),
  /** The gallery copy of a photo or a PDF's first page, which goes up beside the file. */
  thumbnail: z.boolean().default(false),
});

/** Filing uploaded files into Docs, at the top or in a folder of this job. */
export const fileRegisterSchema = z.object({
  folderId: z.string().min(1).max(64).nullable().default(null),
  uploads: uploadsSchema.min(1, "validation.required"),
});

/** The longest window the schedule is read over at once: a quarter, and then some. */
export const MAX_SCHEDULE_DAYS = 100;
