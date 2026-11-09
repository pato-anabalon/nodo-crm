import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { AttachButton, AttachmentStrip } from "@/components/attachments";
import { Avatar, personName } from "@/components/avatars";
import { Button } from "@/components/button";
import { TodoCheck } from "@/components/check";
import { FileGrid } from "@/components/files";
import { RichText } from "@/components/rich-text";
import { ErrorText, Failed, Loading } from "@/components/screen";
import { useColor } from "@/lib/brand";
import { useErrorText } from "@/lib/errors";
import { formatDay, useElapsed } from "@/lib/format";
import { canOn, useAddTodoComment, useJob, useMe, useSetDone, useTodo } from "@/lib/queries";
import type { Comment, TodoDetail } from "@/lib/types";
import { useAttachments } from "@/lib/uploads";

/** One to-do: ticking it, what it is, who has it, its notes and files, and its conversation. */
export default function TodoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const errorText = useErrorText();
  const todo = useTodo(id);
  const job = useJob(todo.data?.todo.jobId ?? "");
  const setDone = useSetDone(todo.data?.todo.jobId ?? "");
  const spinner = useColor("muted-foreground");

  if (todo.isPending) return <Loading />;
  if (!todo.data) return <Failed text={errorText(todo.error)} retry={() => todo.refetch()} retryLabel={t("mobile.retry")} />;

  const detail = todo.data.todo;
  const canEdit = canOn(job.data, "todos.update");
  const canComment = canOn(job.data, "comments.create");

  return (
    <>
      <Stack.Screen
        options={{
          title: detail.list.name,
          headerRight: canEdit
            ? () => (
                <Link href={{ pathname: "/todos/[id]/edit", params: { id } }} asChild>
                  <Pressable accessibilityRole="button" hitSlop={8} className="min-h-11 justify-center px-1">
                    <Text className="text-body font-medium text-brand-ink">{t("jobs.todos.edit")}</Text>
                  </Pressable>
                </Link>
              )
            : undefined,
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100} className="flex-1">
        <ScrollView
          contentContainerClassName="gap-section px-gutter pb-section pt-stack"
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={todo.isRefetching} onRefresh={() => void todo.refetch()} tintColor={spinner} />}
        >
          <View className="flex-row items-start gap-1">
            <View className="-ml-3">
              <TodoCheck
                done={detail.done}
                label={t(detail.done ? "jobs.todos.markOpen" : "jobs.todos.markDone", { title: detail.title })}
                disabled={!canOn(job.data, "todos.complete")}
                onChange={(done) => setDone.mutate({ id: detail.id, done })}
              />
            </View>
            <Text
              accessibilityRole="header"
              className={`flex-1 pt-2 text-title-2 ${detail.done ? "text-muted-foreground line-through" : "text-foreground"}`}
            >
              {detail.title}
            </Text>
          </View>
          <ErrorText>{setDone.error ? errorText(setDone.error) : null}</ErrorText>

          <Facts todo={detail} />
          {detail.notes ? <RichText html={detail.notes} /> : null}
          <FileGrid files={detail.files} />

          <Comments comments={detail.comments} />
        </ScrollView>
        {canComment ? <Composer todoId={detail.id} jobId={detail.jobId} /> : null}
      </KeyboardAvoidingView>
    </>
  );
}

/** When, who has it, who wrote it down and who finished it — the web's sidebar, stacked. */
function Facts({ todo }: { todo: TodoDetail }) {
  const t = useTranslations("jobs.todos");
  const { data: me } = useMe();
  const formatLocale = me?.company.formatLocale ?? "en-NZ";
  const day = (iso: string) =>
    new Intl.DateTimeFormat(formatLocale, { day: "numeric", month: "short", timeZone: me?.company.timezone }).format(new Date(iso));
  const due = todo.dueOn ? formatDay(todo.dueOn, formatLocale) : null;
  const starts = todo.startsOn ? formatDay(todo.startsOn, formatLocale) : null;
  const when = starts && due ? t("dates.range", { start: starts, end: due }) : due ? t("dates.due", { date: due }) : starts ? t("dates.starts", { date: starts }) : t("noDates");

  return (
    <View className="gap-stack-loose rounded-xl border border-border bg-card p-card-pad">
      <Fact label={t("when")}>
        <Text className={`text-callout ${todo.overdue ? "font-semibold text-destructive" : "text-card-foreground"}`}>
          {when}
          {todo.overdue ? ` · ${t("overdue")}` : ""}
        </Text>
      </Fact>
      <Fact label={t("assignees")}>
        {todo.assignees.length ? (
          <View className="gap-1.5">
            {todo.assignees.map((person) => (
              <View key={person.id} className="flex-row items-center gap-2">
                <Avatar person={person} size={24} />
                <Text className="text-callout text-card-foreground">{personName(person)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="text-callout text-muted-foreground">{t("unassigned")}</Text>
        )}
      </Fact>
      <Text className="text-footnote text-muted-foreground">
        {t("addedBy", { name: personName(todo.createdBy, t("someone")), when: day(todo.createdAt) })}
        {todo.done && todo.completedAt
          ? `\n${t("completedBy", { name: personName(todo.completedBy, t("someone")), when: day(todo.completedAt) })}`
          : ""}
      </Text>
    </View>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1">
      <Text className="text-label uppercase text-muted-foreground">{label}</Text>
      {children}
    </View>
  );
}

function Comments({ comments }: { comments: Comment[] }) {
  const t = useTranslations("jobs.board");
  const { data: me } = useMe();
  const ago = useElapsed(me?.company.formatLocale ?? "en-NZ", me?.company.timezone ?? "UTC");

  return (
    <View className="gap-stack-loose">
      <Text accessibilityRole="header" className="text-title-3 text-foreground">
        {t("comments", { count: comments.length })}
      </Text>
      {comments.map((comment) => (
        <View key={comment.id} className="flex-row gap-3">
          {comment.author ? <Avatar person={comment.author} size={32} /> : <View className="size-8" />}
          <View className="flex-1 gap-1.5">
            <Text className="text-footnote text-muted-foreground">
              <Text className="font-semibold text-foreground">{personName(comment.author, "—")}</Text> · {ago(comment.createdAt)}
            </Text>
            <RichText html={comment.body} />
            <FileGrid files={comment.files} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Pinned under the conversation, above the keyboard: what the thumb reaches. Photos go up as they're picked. */
function Composer({ todoId, jobId }: { todoId: string; jobId: string }) {
  const t = useTranslations("jobs.board");
  const errorText = useErrorText();
  const add = useAddTodoComment(todoId);
  const files = useAttachments(jobId);
  const insets = useSafeAreaInsets();
  const placeholder = useColor("muted-foreground");
  const [body, setBody] = useState("");
  const ready = (body.trim() !== "" || files.ready.length > 0) && !files.busy && !files.failed;

  const send = () => {
    const uploads = files.ready;
    add.mutate(
      { body: body.trim(), uploads },
      {
        onSuccess: () => {
          setBody("");
          files.drop(uploads);
        },
      },
    );
  };

  return (
    <View style={{ paddingBottom: Math.max(insets.bottom, 12) }} className="gap-2 border-t border-border bg-card px-gutter pt-3">
      <ErrorText>{add.error ? errorText(add.error) : null}</ErrorText>
      <AttachmentStrip items={files.items} onRemove={files.remove} onRetry={(key) => void files.retry(key)} />
      <View className="flex-row items-end gap-2">
        <AttachButton onPicked={(assets) => void files.add(assets)} />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={t("commentPlaceholder")}
          placeholderTextColor={placeholder}
          accessibilityLabel={t("comment")}
          multiline
          className="max-h-32 min-h-12 flex-1 rounded-xl border border-input bg-field px-4 py-3 text-body text-foreground"
        />
        <Button label={t("comment")} busy={add.isPending} disabled={!ready} onPress={send} />
      </View>
    </View>
  );
}
