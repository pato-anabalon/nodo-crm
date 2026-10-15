import type { Person } from "../avatars";
import { dayKey } from "../schemas";
import { isOverdue } from "./rules";
import type { TodoRow } from "./service";

/** A to-do as a row of a list draws it — plain data, safe to hand to the browser. */
export type TodoItem = {
  id: string;
  href: string;
  title: string;
  position: number;
  done: boolean;
  hasNotes: boolean;
  comments: number;
  files: number;
  assignees: Person[];
  /** "Due 12 Mar", "3 – 12 Mar", already in the reader's words. */
  when: string | null;
  overdue: boolean;
};

type Translator = (key: string, values?: Record<string, string | number>) => string;

/** A to-do's days in the reader's words, or null when it has none. */
export function todoDatesLabel(
  startsOn: string | null,
  dueOn: string | null,
  t: Translator,
  formatDay: (day: string) => string,
): string | null {
  if (startsOn && dueOn) return t("dates.range", { start: formatDay(startsOn), end: formatDay(dueOn) });
  if (dueOn) return t("dates.due", { date: formatDay(dueOn) });
  if (startsOn) return t("dates.starts", { date: formatDay(startsOn) });
  return null;
}

export function toTodoItem(
  jobId: string,
  row: TodoRow,
  helpers: { today: string; t: Translator; formatDay: (day: string) => string },
): TodoItem {
  const done = row.completedAt !== null;
  const dueOn = dayKey(row.dueOn);
  return {
    id: row.id,
    href: `/jobs/${jobId}/todos/${row.id}`,
    title: row.title,
    position: row.position,
    done,
    hasNotes: Boolean(row.notes),
    comments: row._count.comments,
    files: row._count.files,
    assignees: row.assignees.map((assignee) => assignee.user),
    when: todoDatesLabel(dayKey(row.startsOn), dueOn, helpers.t, helpers.formatDay),
    overdue: isOverdue(dueOn, done, helpers.today),
  };
}
