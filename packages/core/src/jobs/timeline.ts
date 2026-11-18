import type { Permission } from "../auth/permissions";

/** The database's `JobActivityType`, as plain strings; a test in the web holds the two together. */
export const JOB_ACTIVITY_TYPES = [
  "CREATED",
  "MEMBERS_ADDED",
  "MEMBER_REMOVED",
  "STATUS_CHANGED",
  "JOB_FINISHED",
  "JOB_REOPENED",
  "DATES_CHANGED",
  "FILES_UPLOADED",
  "FOLDER_CREATED",
  "POST_PUBLISHED",
  "COMMENT_ADDED",
  "TODO_LIST_CREATED",
  "TODO_ADDED",
  "TODO_COMPLETED",
  "TODO_REOPENED",
  "TODO_COMMENTED",
  "EVENT_CREATED",
  "EVENT_COMMENTED",
  "CHAT_MESSAGES",
  "QUOTE_LINKED",
  "QUOTE_UNLINKED",
  "SCOPE_CHANGED",
] as const;
export type JobActivityType = (typeof JOB_ACTIVITY_TYPES)[number];

/** The database's `JobStatus`, likewise. */
export const JOB_STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * The job's timeline, as Basecamp lays it out: a heading per day, and between
 * days the silence said out loud — "No activity for 176 days" is information
 * about a job, not padding.
 *
 * Pure, so the day boundaries (which belong to the company's timezone, not the
 * server's) can be checked without a database.
 */

/** `YYYY-MM-DD` of an instant, in the given timezone. */
export function dayIn(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD; the locale is only a vehicle for the shape.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function daysBetween(later: string, earlier: string): number {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000);
}

export type TimelineDay<T> = {
  day: string;
  /** Whole days with nothing between this day and the one above it (or today). */
  quietBefore: number;
  entries: T[];
};

/** Groups rows already sorted newest first. */
export function groupByDay<T extends { createdAt: Date }>(
  rows: T[],
  timeZone: string,
  now: Date = new Date(),
): TimelineDay<T>[] {
  const days: TimelineDay<T>[] = [];
  let above = dayIn(now, timeZone);
  for (const row of rows) {
    const day = dayIn(row.createdAt, timeZone);
    const current = days[days.length - 1];
    if (current && current.day === day) {
      current.entries.push(row);
      continue;
    }
    days.push({ day, quietBefore: Math.max(0, daysBetween(above, day) - 1), entries: [row] });
    above = day;
  }
  return days;
}

type Translator = (key: string, values?: Record<string, string | number>) => string;

export type ActivityLine = {
  /** A string rather than the union: rows outlive the code that wrote them. */
  type: string;
  params: unknown;
  actorName: string | null;
};

/**
 * One line of the timeline in the reader's language. Parameters are tokens —
 * a status is `COMPLETED`, never "Completed" — so each reader gets their own
 * words. Anything that can't be read is shown as written rather than crashing
 * the page: these rows outlive the code that wrote them.
 */
export function describeJobActivity(
  line: ActivityLine,
  t: Translator,
  helpers: {
    nameOf: (userId: string) => string;
    list: (names: string[]) => string;
    formatDay: (day: string) => string;
  },
): string {
  const params = (line.params && typeof line.params === "object" ? line.params : {}) as Record<string, unknown>;
  const actor = line.actorName ?? t("someone");
  const str = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : null);

  switch (line.type) {
    case "CREATED": {
      const reference = str("quoteNumber");
      return reference ? t("CREATED_fromQuote", { actor, reference }) : t("CREATED", { actor });
    }
    case "QUOTE_LINKED":
    case "QUOTE_UNLINKED":
      return t(line.type, { actor, reference: str("quoteNumber") ?? "" });
    case "MEMBERS_ADDED": {
      const ids = Array.isArray(params.userIds) ? params.userIds.filter((v): v is string => typeof v === "string") : [];
      return t("MEMBERS_ADDED", { actor, names: helpers.list(ids.map(helpers.nameOf)) });
    }
    case "MEMBER_REMOVED": {
      const userId = str("userId");
      return t("MEMBER_REMOVED", { actor, name: userId ? helpers.nameOf(userId) : t("someone") });
    }
    case "STATUS_CHANGED": {
      const to = str("to") ?? "";
      const label = (JOB_STATUSES as readonly string[]).includes(to) ? t(`status.${to}`) : to;
      return t("STATUS_CHANGED", { actor, to: label });
    }
    case "JOB_FINISHED":
      return t("JOB_FINISHED", { actor });
    case "JOB_REOPENED":
      return t("JOB_REOPENED", { actor });
    case "DATES_CHANGED": {
      const start = str("startsOn");
      const end = str("endsOn");
      if (!start && !end) return t("DATES_CLEARED", { actor });
      return t("DATES_CHANGED", { actor, dates: dateRange(start, end, t, helpers.formatDay) });
    }
    case "FILES_UPLOADED": {
      const count = typeof params.count === "number" ? params.count : 0;
      return t("FILES_UPLOADED", { actor, count });
    }
    case "FOLDER_CREATED":
      return t("FOLDER_CREATED", { actor, name: str("name") ?? "" });
    case "POST_PUBLISHED":
      return t("POST_PUBLISHED", { actor, title: str("title") ?? "" });
    case "COMMENT_ADDED":
      return t("COMMENT_ADDED", { actor, title: str("title") ?? "" });
    case "TODO_LIST_CREATED":
      return t("TODO_LIST_CREATED", { actor, name: str("name") ?? "" });
    case "TODO_ADDED":
    case "TODO_COMPLETED":
    case "TODO_REOPENED":
    case "TODO_COMMENTED":
      return t(line.type, { actor, title: str("title") ?? "" });
    case "EVENT_CREATED": {
      const day = str("startsOn");
      return day
        ? t("EVENT_CREATED", { actor, title: str("title") ?? "", date: helpers.formatDay(day) })
        : t("EVENT_CREATED_undated", { actor, title: str("title") ?? "" });
    }
    case "EVENT_COMMENTED":
      return t("EVENT_COMMENTED", { actor, title: str("title") ?? "" });
    case "CHAT_MESSAGES":
      return t("CHAT_MESSAGES", { actor, count: typeof params.count === "number" ? params.count : 1 });
    case "SCOPE_CHANGED": {
      const action = str("action");
      const known = action === "added" || action === "edited" || action === "deleted";
      return t("SCOPE_CHANGED", { actor, action: known ? action : "edited", title: str("title") ?? "" });
    }
    default:
      return String(line.type);
  }
}

/** "3 March – 20 April", or one end of it, in the reader's words. */
export function dateRange(
  start: string | null,
  end: string | null,
  t: Translator,
  formatDay: (day: string) => string,
): string {
  if (start && end) return t("dateRange", { start: formatDay(start), end: formatDay(end) });
  if (start) return t("startsOnly", { start: formatDay(start) });
  if (end) return t("endsOnly", { end: formatDay(end) });
  return t("noDates");
}

/**
 * The tool a timeline line belongs to, by the permission that reads it. Taking
 * a tool away from a profile takes its lines off the timeline too — a photo
 * hidden from the Docs & Files screen shouldn't reappear as a thumbnail here.
 */
export function activityPermission(type: string): Permission {
  switch (type) {
    case "FILES_UPLOADED":
    case "FOLDER_CREATED":
      return "files.read";
    case "POST_PUBLISHED":
    case "COMMENT_ADDED":
      return "messages.read";
    case "TODO_LIST_CREATED":
    case "TODO_ADDED":
    case "TODO_COMPLETED":
    case "TODO_REOPENED":
    case "TODO_COMMENTED":
      return "todos.read";
    case "EVENT_CREATED":
    case "EVENT_COMMENTED":
      return "schedule.read";
    case "CHAT_MESSAGES":
      return "chat.read";
    case "SCOPE_CHANGED":
      return "scope.read";
    default:
      return "jobs.read";
  }
}

/** The files a FILES_UPLOADED line shows as thumbnails. */
export function activityFileIds(params: unknown): string[] {
  const ids = params && typeof params === "object" ? (params as Record<string, unknown>).fileIds : null;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

/**
 * Where a timeline line leads, if anywhere: a post line opens the post, a
 * to-do line the to-do, a comment line the comment itself. Lines about the
 * job itself lead nowhere — the reader is already on it.
 */
export function activityHref(jobId: string, type: string, params: unknown): string | null {
  const p = params && typeof params === "object" ? (params as Record<string, unknown>) : {};
  const postId = typeof p.postId === "string" ? p.postId : null;
  const todoId = typeof p.todoId === "string" ? p.todoId : null;
  const listId = typeof p.listId === "string" ? p.listId : null;
  const eventId = typeof p.eventId === "string" ? p.eventId : null;
  const commentAnchor = typeof p.commentId === "string" ? `#comment-${p.commentId}` : "";
  switch (type) {
    case "POST_PUBLISHED":
      return postId ? `/jobs/${jobId}/messages/${postId}` : null;
    case "COMMENT_ADDED":
      if (!postId) return null;
      return typeof p.commentId === "string"
        ? `/jobs/${jobId}/messages/${postId}#comment-${p.commentId}`
        : `/jobs/${jobId}/messages/${postId}`;
    case "FILES_UPLOADED":
    case "FOLDER_CREATED":
      return typeof p.folderId === "string" ? `/jobs/${jobId}/files?folder=${p.folderId}` : `/jobs/${jobId}/files`;
    case "TODO_LIST_CREATED":
      return listId ? `/jobs/${jobId}/todos/lists/${listId}` : null;
    case "TODO_ADDED":
    case "TODO_COMPLETED":
    case "TODO_REOPENED":
      return todoId ? `/jobs/${jobId}/todos/${todoId}` : null;
    case "TODO_COMMENTED":
      if (todoId) return `/jobs/${jobId}/todos/${todoId}${commentAnchor}`;
      return listId ? `/jobs/${jobId}/todos/lists/${listId}${commentAnchor}` : null;
    case "EVENT_CREATED":
    case "EVENT_COMMENTED":
      return eventId ? `/jobs/${jobId}/schedule/${eventId}${commentAnchor}` : null;
    case "CHAT_MESSAGES":
      return `/jobs/${jobId}/chat`;
    case "SCOPE_CHANGED":
      return `/jobs/${jobId}/scope`;
    default:
      return null;
  }
}
