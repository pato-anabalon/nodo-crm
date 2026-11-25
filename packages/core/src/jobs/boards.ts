import type { Permission } from "../auth/permissions";

/**
 * A job has two boards that work alike: the Message Board, for everybody on
 * the job, and the confidential one, for what the office keeps from the crew
 * — a contract, the invoicing. Same posts, drafts, categories, files and
 * comments; what tells them apart is this table: which permissions open each
 * one, where it lives, and the timeline lines it writes.
 *
 * Everything that reads a post asks its board here, so a confidential post
 * never answers to `messages.read`.
 */

/** The database's `JobBoard`; a test in the web holds the two together. */
export const JOB_BOARDS = ["TEAM", "CONFIDENTIAL"] as const;
export type JobBoard = (typeof JOB_BOARDS)[number];

export type BoardRules = {
  /** The path segment under `/jobs/<id>/`. */
  segment: string;
  read: Permission;
  create: Permission;
  update: Permission;
  delete: Permission;
  /** The timeline lines a post and a comment on it write. */
  published: "POST_PUBLISHED" | "CONFIDENTIAL_POST_PUBLISHED";
  commented: "COMMENT_ADDED" | "CONFIDENTIAL_COMMENT_ADDED";
};

export const BOARDS: Record<JobBoard, BoardRules> = {
  TEAM: {
    segment: "messages",
    read: "messages.read",
    create: "messages.create",
    update: "messages.update",
    delete: "messages.delete",
    published: "POST_PUBLISHED",
    commented: "COMMENT_ADDED",
  },
  CONFIDENTIAL: {
    segment: "confidential",
    read: "confidential.read",
    create: "confidential.create",
    update: "confidential.update",
    delete: "confidential.delete",
    published: "CONFIDENTIAL_POST_PUBLISHED",
    commented: "CONFIDENTIAL_COMMENT_ADDED",
  },
};

/** A stored or posted board, read defensively: anything that isn't one is the Message Board's. */
export function boardOf(value: unknown): JobBoard {
  return value === "CONFIDENTIAL" ? "CONFIDENTIAL" : "TEAM";
}

/** The page of a board, or of one post on it. */
export function boardPath(jobId: string, board: JobBoard, postId?: string): string {
  const base = `/jobs/${jobId}/${BOARDS[board].segment}`;
  return postId ? `${base}/${postId}` : base;
}
