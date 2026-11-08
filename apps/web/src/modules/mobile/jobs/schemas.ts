import { z } from "zod";

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
});

export const completionSchema = z.object({ done: z.boolean() });

export const textSchema = z.object({ body: z.string().max(20_000) });

/** The longest window the schedule is read over at once: a quarter, and then some. */
export const MAX_SCHEDULE_DAYS = 100;
