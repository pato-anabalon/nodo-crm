import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { Failed, Loading } from "@/components/screen";
import { TodoForm } from "@/components/todo-form";
import { useErrorText } from "@/lib/errors";
import { useJob, useMe } from "@/lib/queries";

/** A new to-do at the bottom of a list, assigned to whoever adds it unless they say otherwise — as on the web. */
export default function NewTodo() {
  const { id, jobId } = useLocalSearchParams<{ id: string; jobId: string }>();
  const t = useTranslations();
  const errorText = useErrorText();
  const job = useJob(jobId);
  const { data: me } = useMe();

  if (job.isPending) return <Loading />;
  if (!job.data) return <Failed text={errorText(job.error)} retry={() => job.refetch()} retryLabel={t("mobile.retry")} />;

  const members = job.data.job.members;
  const mine = me && members.some((member) => member.id === me.user.id) ? [me.user.id] : [];

  return (
    <>
      <Stack.Screen options={{ title: t("jobs.todos.addTodo") }} />
      <TodoForm
        jobId={jobId}
        target={{ listId: id }}
        initial={{ title: "", notes: "", startsOn: null, dueOn: null, assigneeIds: mine }}
        members={members}
        submitLabel={t("jobs.todos.addThisTodo")}
      />
    </>
  );
}
