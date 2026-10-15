import type { Permission } from "@/lib/auth/permissions";

/**
 * What a comment is about. A `JobComment` carries one nullable key per thing
 * that can be commented on, and a check in the database holds it to exactly
 * one; this turns those keys into the one answer every caller needs.
 *
 * Pure, so the routing of a comment — which tool reads it, where it lives —
 * can be checked without a database.
 */
export type CommentSubject =
  | { kind: "post"; id: string }
  | { kind: "todo"; id: string }
  | { kind: "list"; id: string };

export function commentSubject(row: {
  postId: string | null;
  todoId: string | null;
  todoListId: string | null;
}): CommentSubject | null {
  if (row.postId) return { kind: "post", id: row.postId };
  if (row.todoId) return { kind: "todo", id: row.todoId };
  if (row.todoListId) return { kind: "list", id: row.todoListId };
  return null;
}

/**
 * The permission that reads the thing commented on. A comment is part of what
 * it is about: somebody whose profile doesn't read to-dos doesn't reach a
 * to-do's comments through the comment either.
 */
export function subjectReadPermission(subject: CommentSubject): Permission {
  return subject.kind === "post" ? "messages.read" : "todos.read";
}

/** The page the thing commented on lives on. */
export function subjectPath(jobId: string, subject: CommentSubject): string {
  switch (subject.kind) {
    case "post":
      return `/jobs/${jobId}/messages/${subject.id}`;
    case "todo":
      return `/jobs/${jobId}/todos/${subject.id}`;
    case "list":
      return `/jobs/${jobId}/todos/lists/${subject.id}`;
  }
}

/** One comment, on its page: what a notice or a timeline line links to. */
export function commentHref(jobId: string, subject: CommentSubject, commentId: string): string {
  return `${subjectPath(jobId, subject)}#comment-${commentId}`;
}
