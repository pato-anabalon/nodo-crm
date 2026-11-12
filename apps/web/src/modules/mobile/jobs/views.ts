import type { Permission } from "@nodo/core/auth/permissions";
import { kindOfContentType } from "@nodo/core/jobs/files";
import { canTouch } from "@nodo/core/jobs/rules";
import { isOverdue } from "@nodo/core/jobs/todos/rules";
import type { CompanyContext } from "@/lib/auth/session";
import { sanitizeRichText } from "@/lib/rich-text";
import type { JobFileRow } from "@/modules/jobs/files-service";
import { dayKey } from "@/modules/jobs/schemas";
import { dayIn } from "@/modules/jobs/timeline";
import type { TodoRow } from "@/modules/jobs/todos/service";

/**
 * What the app is handed: data, not text. Instants are ISO strings, days are
 * `YYYY-MM-DD` on the company's calendar, and nothing is formatted or worded —
 * the app has the company's format and the person's language from `/me` and
 * does both, the way it translates the error codes.
 *
 * Whatever depends on the reader's permissions is worked out here, as the web
 * does, and sent as a flag: the app is told whether it may delete a message,
 * not the rule.
 */

export type PersonView = { id: string; name: string | null; email: string; image: string | null };

export function today(ctx: CompanyContext): string {
  return dayIn(new Date(), ctx.company.timezone);
}

/** A real calendar day, not just its shape: `2026-02-30` would read as March. */
export function isDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** What this person may do on this job — a finished job's context has the writes taken off already. */
export function permissionList(permissions: ReadonlySet<Permission>): Permission[] {
  return [...permissions].sort();
}

export function fileView(file: JobFileRow) {
  return {
    id: file.id,
    name: file.name,
    url: file.url,
    contentType: file.contentType,
    kind: kindOfContentType(file.contentType),
    size: file.size,
    width: file.width,
    height: file.height,
    thumbnailUrl: file.thumbnailUrl,
    createdAt: file.createdAt.toISOString(),
  };
}

/** Rich text is sanitised again on the way out, as everywhere it is shown. */
export function richText(html: string | null): string | null {
  return html ? sanitizeRichText(html, "full") : null;
}

type CommentRow = {
  id: string;
  body: string;
  authorId: string | null;
  createdAt: Date;
  editedAt: Date | null;
  author: PersonView | null;
  files: JobFileRow[];
};

export function commentView(ctx: CompanyContext, comment: CommentRow) {
  return {
    id: comment.id,
    body: richText(comment.body) ?? "",
    author: comment.author,
    createdAt: comment.createdAt.toISOString(),
    editedAt: comment.editedAt?.toISOString() ?? null,
    files: comment.files.map(fileView),
    canUpdate: canTouch(ctx.user.id, ctx.permissions, "comments.update", comment.authorId),
    canDelete: canTouch(ctx.user.id, ctx.permissions, "comments.delete", comment.authorId),
  };
}

export function todoRowView(row: TodoRow, day: string) {
  const done = row.completedAt !== null;
  const dueOn = dayKey(row.dueOn);
  return {
    id: row.id,
    listId: row.listId,
    title: row.title,
    position: row.position,
    hasNotes: Boolean(row.notes),
    startsOn: dayKey(row.startsOn),
    dueOn,
    done,
    completedAt: row.completedAt?.toISOString() ?? null,
    overdue: isOverdue(dueOn, done, day),
    assignees: row.assignees.map((assignee) => assignee.user),
    comments: row._count.comments,
    files: row._count.files,
  };
}
