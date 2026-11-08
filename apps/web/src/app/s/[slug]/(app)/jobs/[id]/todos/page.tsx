import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { requireJobContext } from "@/modules/jobs/access";
import { assignableMembers, listTodoLists } from "@/modules/jobs/todos/service";
import { createTodoListAction, reorderTodoListsAction, setTodoCompletedAction } from "@/modules/jobs/todos/actions";
import { listDataBuilder } from "@/modules/jobs/todos/list-data";
import { NewTodoListButton } from "@/modules/jobs/todos/list-controls";
import { TodoListsBoard } from "@/modules/jobs/todos/todo-lists";

export async function generateMetadata() {
  const t = await getTranslations("jobs.todos");
  return { title: t("title") };
}

export default async function TodosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, job } = await requireJobContext(id, "todos.read");
  const [t, lists, people] = await Promise.all([
    getTranslations("jobs.todos"),
    listTodoLists(ctx, job.id),
    assignableMembers(ctx, job.id),
  ]);
  const toData = await listDataBuilder(ctx, job.id, people);
  const open = lists.reduce((sum, list) => sum + list.open.length, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href={`/jobs/${job.id}`} aria-label={t("backToJob", { name: job.name })}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {job.name}
              {lists.length > 0 ? ` · ${t("openCount", { count: open })}` : null}
            </p>
          </div>
        </div>
        {can(ctx, "todos.create") ? <NewTodoListButton action={createTodoListAction.bind(null, job.id)} /> : null}
      </div>

      {lists.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm italic text-muted-foreground">
          {can(ctx, "todos.create") ? t("emptyCanCreate") : t("empty")}
        </p>
      ) : (
        <TodoListsBoard
          lists={lists.map(toData)}
          canReorder={can(ctx, "todos.update")}
          canComplete={can(ctx, "todos.complete")}
          onToggle={setTodoCompletedAction}
          onReorderLists={reorderTodoListsAction.bind(null, job.id)}
        />
      )}
    </div>
  );
}
