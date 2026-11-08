import { getTranslations } from "next-intl/server";
import { can, type CompanyContext } from "@/lib/auth/session";
import { RichText } from "@/components/rich-text";
import type { Person } from "../avatars";
import { jobUploadPrefix } from "../files";
import { dayIn } from "../timeline";
import { createTodoAction, reorderTodosAction } from "./actions";
import type { TodoListView } from "./service";
import { NewTodoForm } from "./todo-form";
import type { TodoListData } from "./todo-lists";
import { toTodoItem } from "./view";

/**
 * Everything a list hands to the browser, built on the server: the rows in the
 * reader's words, the description already rendered (the sanitiser stays
 * here), and the actions bound to this list.
 */
export async function listDataBuilder(ctx: CompanyContext, jobId: string, people: Person[]) {
  const t = await getTranslations("jobs.todos");
  const { formatLocale, timezone } = ctx.company;
  const short = new Intl.DateTimeFormat(formatLocale, { day: "numeric", month: "short", timeZone: "UTC" });
  const helpers = {
    today: dayIn(new Date(), timezone),
    t: (key: string, values?: Record<string, string | number>) => t(key, values),
    formatDay: (day: string) => short.format(new Date(`${day}T00:00:00Z`)),
  };
  const prefix = jobUploadPrefix(ctx.company.id, jobId);
  const canAdd = can(ctx, "todos.create");

  return (list: Pick<TodoListView, "id" | "name" | "description" | "open" | "done" | "_count">): TodoListData => ({
    id: list.id,
    name: list.name,
    href: `/jobs/${jobId}/todos/lists/${list.id}`,
    description: list.description ? (
      <RichText html={list.description} profile="full" className="text-sm text-muted-foreground" />
    ) : null,
    comments: list._count.comments,
    open: list.open.map((row) => toTodoItem(jobId, row, helpers)),
    done: list.done.map((row) => toTodoItem(jobId, row, helpers)),
    onReorder: reorderTodosAction.bind(null, list.id),
    addForm: canAdd ? (
      <NewTodoForm action={createTodoAction.bind(null, list.id)} jobId={jobId} prefix={prefix} people={people} />
    ) : null,
  });
}
