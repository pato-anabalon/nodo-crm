import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { requireJobContext } from "@/modules/jobs/access";
import { CommentThread } from "@/modules/jobs/comments/thread";
import { assignableMembers, getTodoList } from "@/modules/jobs/todos/service";
import {
  createListCommentAction,
  deleteTodoListAction,
  setTodoCompletedAction,
  updateTodoListAction,
} from "@/modules/jobs/todos/actions";
import { listDataBuilder } from "@/modules/jobs/todos/list-data";
import { DeleteTodoListButton, EditTodoListButton } from "@/modules/jobs/todos/list-controls";
import { TodoListBlock } from "@/modules/jobs/todos/todo-lists";

type Params = { id: string; listId: string };

export async function generateMetadata() {
  const t = await getTranslations("jobs.todos");
  return { title: t("title") };
}

export default async function TodoListPage({ params }: { params: Promise<Params> }) {
  const { id, listId } = await params;
  const { ctx, job } = await requireJobContext(id, "todos.read");
  const [list, people] = await Promise.all([getTodoList(ctx, job.id, listId), assignableMembers(ctx, job.id)]);
  if (!list) notFound();

  const t = await getTranslations("jobs.todos");
  const toData = await listDataBuilder(ctx, job.id, people);
  const total = list.open.length + list.done.length;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={`/jobs/${job.id}/todos`} aria-label={t("backToTodos")}>
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
        </p>
      </div>

      <article className="space-y-4 rounded-xl border bg-card p-5 sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-balance">{list.name}</h1>
            <p className="text-sm text-muted-foreground">{t("progress", { done: list.done.length, total })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can(ctx, "todos.update") ? (
              <EditTodoListButton
                action={updateTodoListAction.bind(null, list.id)}
                defaults={{ name: list.name, description: list.description ?? "" }}
              />
            ) : null}
            {can(ctx, "todos.delete") ? (
              <DeleteTodoListButton
                name={list.name}
                onDelete={async () => {
                  "use server";
                  return deleteTodoListAction(listId);
                }}
              />
            ) : null}
          </div>
        </header>

        <TodoListBlock
          list={toData(list)}
          canReorder={can(ctx, "todos.update")}
          canComplete={can(ctx, "todos.complete")}
          onToggle={setTodoCompletedAction}
        />
      </article>

      <div id="comments" className="scroll-mt-20">
        <CommentThread
          ctx={ctx}
          jobId={job.id}
          comments={list.comments}
          onCreate={can(ctx, "comments.create") ? createListCommentAction.bind(null, list.id) : null}
        />
      </div>
    </div>
  );
}
