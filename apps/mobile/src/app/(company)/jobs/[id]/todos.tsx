import { Link, useLocalSearchParams } from "expo-router";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { RichText } from "@/components/rich-text";
import { Empty, ErrorText, Failed, Loading } from "@/components/screen";
import { TodoRow } from "@/components/todo-row";
import { useColor } from "@/lib/brand";
import { useErrorText } from "@/lib/errors";
import { canOn, useJob, useMe, useSetDone, useTodoLists } from "@/lib/queries";
import type { TodoList } from "@/lib/types";

/**
 * A job's lists, each a stage of the work, in the order somebody planned
 * them. Open to-dos first; done ones folded away under a count, latest
 * first. Reordering stays on the web, where there is room to see the plan.
 */
export default function Todos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const errorText = useErrorText();
  const job = useJob(id);
  const lists = useTodoLists(id);
  const setDone = useSetDone(id);
  const { data: me } = useMe();
  const spinner = useColor("muted-foreground");

  const formatLocale = me?.company.formatLocale ?? "en-NZ";
  const canComplete = canOn(job.data, "todos.complete");
  const canCreate = canOn(job.data, "todos.create");

  return (
    <>
      {lists.isPending ? (
        <Loading />
      ) : !lists.data ? (
        <Failed text={errorText(lists.error)} retry={() => lists.refetch()} retryLabel={t("mobile.retry")} />
      ) : (
        <ScrollView
          contentContainerClassName="grow gap-section px-gutter pb-section pt-stack"
          refreshControl={<RefreshControl refreshing={lists.isRefetching} onRefresh={() => void lists.refetch()} tintColor={spinner} />}
        >
          {/* A refused tick has gone back by itself; this says why. */}
          <ErrorText>{setDone.error ? errorText(setDone.error) : null}</ErrorText>
          {lists.data.lists.length === 0 ? (
            <Empty text={t("jobs.todos.empty")} />
          ) : (
            lists.data.lists.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                jobId={id}
                formatLocale={formatLocale}
                canComplete={canComplete}
                canCreate={canCreate}
                onTick={(todoId, done) => setDone.mutate({ id: todoId, done })}
              />
            ))
          )}
        </ScrollView>
      )}
    </>
  );
}

function ListCard({
  list,
  jobId,
  formatLocale,
  canComplete,
  canCreate,
  onTick,
}: {
  list: TodoList;
  jobId: string;
  formatLocale: string;
  canComplete: boolean;
  canCreate: boolean;
  onTick: (todoId: string, done: boolean) => void;
}) {
  const t = useTranslations("jobs.todos");
  const [showDone, setShowDone] = useState(false);
  const plus = useColor("brand-ink");
  const total = list.open.length + list.done.length;

  return (
    <View className="gap-stack">
      <View className="gap-0.5">
        <Text accessibilityRole="header" className="text-title-3 text-foreground">
          {list.name}
        </Text>
        {total ? <Text className="text-footnote text-muted-foreground">{t("progress", { done: list.done.length, total })}</Text> : null}
      </View>
      {list.description ? <RichText html={list.description} /> : null}

      <View className="overflow-hidden rounded-xl border border-border bg-card">
        {list.open.map((todo, index) => (
          <View key={todo.id} className={index ? "border-t border-border" : ""}>
            <TodoRow todo={todo} formatLocale={formatLocale} canComplete={canComplete} onTick={(done) => onTick(todo.id, done)} />
          </View>
        ))}
        {list.open.length === 0 ? (
          <Text className="px-card-pad py-3 text-callout text-muted-foreground">{total ? t("allDone") : t("cardEmpty")}</Text>
        ) : null}

        {canCreate ? (
          <Link href={{ pathname: "/todo-lists/[id]/new", params: { id: list.id, jobId } }} asChild>
            <Pressable accessibilityRole="button" className="min-h-12 flex-row items-center gap-2 border-t border-border px-card-pad active:bg-muted">
              <Plus size={20} color={plus} />
              <Text className="text-callout font-medium text-brand-ink">{t("addTodo")}</Text>
            </Pressable>
          </Link>
        ) : null}
      </View>

      {list.done.length ? (
        <Pressable accessibilityRole="button" onPress={() => setShowDone(!showDone)} className="min-h-11 justify-center self-start">
          <Text className="text-callout font-medium text-brand-ink">
            {showDone ? t("hideDone") : t("showDone", { count: list.done.length })}
          </Text>
        </Pressable>
      ) : null}
      {showDone ? (
        <View className="overflow-hidden rounded-xl border border-border bg-card">
          {list.done.map((todo, index) => (
            <View key={todo.id} className={index ? "border-t border-border" : ""}>
              <TodoRow todo={todo} formatLocale={formatLocale} canComplete={canComplete} onTick={(done) => onTick(todo.id, done)} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
