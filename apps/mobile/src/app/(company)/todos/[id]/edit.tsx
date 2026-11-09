import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { Failed, Loading } from "@/components/screen";
import { TodoForm } from "@/components/todo-form";
import { useErrorText } from "@/lib/errors";
import { useJob, useTodo } from "@/lib/queries";
import { htmlToPlainText, isFormatted } from "@/lib/todos";

export default function EditTodo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const errorText = useErrorText();
  const todo = useTodo(id);
  const job = useJob(todo.data?.todo.jobId ?? "");

  if (todo.isPending || job.isPending) return <Loading />;
  if (!todo.data || !job.data) {
    const error = todo.error ?? job.error;
    return <Failed text={errorText(error)} retry={() => void Promise.all([todo.refetch(), job.refetch()])} retryLabel={t("mobile.retry")} />;
  }

  const detail = todo.data.todo;
  return (
    <>
      <Stack.Screen options={{ title: t("jobs.todos.editTodo") }} />
      <TodoForm
        jobId={detail.jobId}
        target={{ todoId: detail.id }}
        initial={{
          title: detail.title,
          notes: htmlToPlainText(detail.notes),
          startsOn: detail.startsOn,
          dueOn: detail.dueOn,
          assigneeIds: detail.assignees.map((person) => person.id),
        }}
        members={job.data.job.members}
        notesFormatted={isFormatted(detail.notes)}
        submitLabel={t("jobs.todos.saveTodo")}
      />
    </>
  );
}
