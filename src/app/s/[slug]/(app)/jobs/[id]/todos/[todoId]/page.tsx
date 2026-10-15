import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Pencil, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/rich-text";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireJobContext } from "@/modules/jobs/access";
import { PersonAvatar, personName } from "@/modules/jobs/avatars";
import { dayKey } from "@/modules/jobs/schemas";
import { dayIn } from "@/modules/jobs/timeline";
import { AttachmentGallery } from "@/modules/jobs/board/attachments";
import { toAttachment } from "@/modules/jobs/board/view";
import { CommentThread } from "@/modules/jobs/comments/thread";
import { getTodo } from "@/modules/jobs/todos/service";
import { createTodoCommentAction, deleteTodoAction, setTodoCompletedAction } from "@/modules/jobs/todos/actions";
import { DeleteTodoButton } from "@/modules/jobs/todos/list-controls";
import { TodoPageCheck } from "@/modules/jobs/todos/todo-lists";
import { isOverdue } from "@/modules/jobs/todos/rules";
import { todoDatesLabel } from "@/modules/jobs/todos/view";

type Params = { id: string; todoId: string };

export async function generateMetadata() {
  const t = await getTranslations("jobs.todos");
  return { title: t("title") };
}

export default async function TodoPage({ params }: { params: Promise<Params> }) {
  const { id, todoId } = await params;
  const { ctx, job } = await requireJobContext(id, "todos.read");
  const todo = await getTodo(ctx, job.id, todoId);
  if (!todo) notFound();
  const t = await getTranslations("jobs.todos");

  const { formatLocale, timezone } = ctx.company;
  const formatDay = (day: string) => formatDate(new Date(`${day}T00:00:00Z`), formatLocale, "UTC");
  const done = todo.completedAt !== null;
  const dates = todoDatesLabel(dayKey(todo.startsOn), dayKey(todo.dueOn), (key, values) => t(key, values), formatDay);
  const overdue = isOverdue(dayKey(todo.dueOn), done, dayIn(new Date(), timezone));
  const files = todo.files.map((file) => toAttachment(file, formatLocale));
  const listHref = `/jobs/${job.id}/todos/lists/${todo.list.id}`;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={listHref} aria-label={t("backToList", { name: todo.list.name })}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <p className="truncate pt-2 text-sm text-muted-foreground">
          <Link href={`/jobs/${job.id}`} className="hover:underline">
            {job.name}
          </Link>
          {" › "}
          <Link href={`/jobs/${job.id}/todos`} className="hover:underline">
            {t("title")}
          </Link>
          {" › "}
          <Link href={listHref} className="hover:underline">
            {todo.list.name}
          </Link>
        </p>
      </div>

      <article className="space-y-6 rounded-xl border bg-card p-5 sm:p-8">
        <header className="flex items-start gap-3">
          <span className="pt-0.5">
            <TodoPageCheck
              todoId={todo.id}
              title={todo.title}
              done={done}
              canComplete={can(ctx, "todos.complete")}
              onToggle={setTodoCompletedAction}
            />
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className={cn("text-2xl font-bold tracking-tight text-balance", done && "text-muted-foreground line-through")}>
              {todo.title}
            </h1>
            {done && todo.completedAt ? (
              <p className="text-sm text-muted-foreground">
                {t("completedBy", {
                  name: todo.completedBy ? personName(todo.completedBy) : t("someone"),
                  when: formatDateTime(todo.completedAt, formatLocale, timezone),
                })}
              </p>
            ) : null}
          </div>
        </header>

        <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" />
            {t("assignees")}
          </dt>
          <dd>
            {todo.assignees.length > 0 ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {todo.assignees.map(({ user }) => (
                  <li key={user.id} className="flex items-center gap-2">
                    <PersonAvatar person={user} size="sm" />
                    {personName(user)}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="italic text-muted-foreground">{t("unassigned")}</span>
            )}
          </dd>
          <dt className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-4" />
            {t("when")}
          </dt>
          <dd className={cn(overdue && "font-medium text-destructive")}>
            {dates ?? <span className="italic text-muted-foreground">{t("noDates")}</span>}
            {overdue ? ` · ${t("overdue")}` : null}
          </dd>
        </dl>

        {todo.notes ? <RichText html={todo.notes} profile="full" className="text-[0.95rem] leading-relaxed" /> : null}
        <AttachmentGallery files={files} />

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {t("addedBy", {
              name: todo.createdBy ? personName(todo.createdBy) : t("someone"),
              when: formatDateTime(todo.createdAt, formatLocale, timezone),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            {can(ctx, "todos.update") ? (
              <Button asChild variant="outline">
                <Link href={`/jobs/${job.id}/todos/${todo.id}/edit`}>
                  <Pencil className="size-4" />
                  {t("edit")}
                </Link>
              </Button>
            ) : null}
            {can(ctx, "todos.delete") ? (
              <DeleteTodoButton
                title={todo.title}
                onDelete={async () => {
                  "use server";
                  return deleteTodoAction(todoId);
                }}
              />
            ) : null}
          </div>
        </footer>
      </article>

      <CommentThread
        ctx={ctx}
        jobId={job.id}
        comments={todo.comments}
        onCreate={can(ctx, "comments.create") ? createTodoCommentAction.bind(null, todo.id) : null}
      />
    </div>
  );
}
