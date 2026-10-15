import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { requireJobContext } from "@/modules/jobs/access";
import { jobUploadPrefix } from "@/modules/jobs/files";
import { dayKey } from "@/modules/jobs/schemas";
import { toAttachment } from "@/modules/jobs/board/view";
import { updateTodoAction } from "@/modules/jobs/todos/actions";
import { assignableMembers, getTodo, listTodoLists } from "@/modules/jobs/todos/service";
import { TodoEditForm } from "@/modules/jobs/todos/todo-form";

export async function generateMetadata() {
  const t = await getTranslations("jobs.todos");
  return { title: t("editTodo") };
}

export default async function EditTodoPage({ params }: { params: Promise<{ id: string; todoId: string }> }) {
  const { id, todoId } = await params;
  const { ctx, job } = await requireJobContext(id, "todos.update");
  if (!can(ctx, "todos.read")) notFound();
  const [todo, people, lists] = await Promise.all([
    getTodo(ctx, job.id, todoId),
    assignableMembers(ctx, job.id),
    listTodoLists(ctx, job.id),
  ]);
  if (!todo) notFound();

  const t = await getTranslations("jobs.todos");
  const back = `/jobs/${job.id}/todos/${todo.id}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={back} aria-label={t("backToTodo")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("editTodo")}</h1>
          <p className="truncate text-sm text-muted-foreground">{job.name}</p>
        </div>
      </div>

      <TodoEditForm
        action={updateTodoAction.bind(null, todo.id)}
        jobId={job.id}
        prefix={jobUploadPrefix(ctx.company.id, job.id)}
        people={people}
        lists={lists.map((list) => ({ value: list.id, label: list.name }))}
        defaults={{
          title: todo.title,
          notes: todo.notes ?? "",
          startsOn: dayKey(todo.startsOn),
          dueOn: dayKey(todo.dueOn),
          assigneeIds: todo.assignees.map(({ user }) => user.id),
          listId: todo.listId,
        }}
        existingFiles={todo.files.map((file) => toAttachment(file, ctx.company.formatLocale))}
        cancelHref={back}
      />
    </div>
  );
}
