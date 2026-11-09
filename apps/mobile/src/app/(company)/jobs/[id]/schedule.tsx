import { addDays } from "@nodo/core/jobs/schedule/calendar";
import { dayIn } from "@nodo/core/jobs/timeline";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight, Diamond, ListChecks } from "lucide-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { AvatarStack } from "@/components/avatars";
import { Failed, Loading } from "@/components/screen";
import { agendaDays, type AgendaEntry } from "@/lib/agenda";
import { useColor } from "@/lib/brand";
import { useErrorText } from "@/lib/errors";
import { formatDay, formatDayHeading, formatTime } from "@/lib/format";
import { useMe, useSchedule } from "@/lib/queries";

/** Four weeks at a time, as the server's window and the web's agenda both are. */
const WINDOW_DAYS = 28;

/**
 * The job's schedule as an agenda: four weeks from today, only the days with
 * something on them, and to-dos falling due beside the events. Read only — the
 * schedule is planned on the web, where the calendar has room.
 */
export default function ScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const errorText = useErrorText();
  const { data: me } = useMe();
  const formatLocale = me?.company.formatLocale ?? "en-NZ";
  const timeZone = me?.company.timezone ?? "UTC";
  const today = dayIn(new Date(), timeZone);
  const [from, setFrom] = useState(today);
  const to = addDays(from, WINDOW_DAYS - 1);
  const schedule = useSchedule(id, from, to);
  const spinner = useColor("muted-foreground");

  if (schedule.isPending) return <Loading />;
  if (!schedule.data) return <Failed text={errorText(schedule.error)} retry={() => schedule.refetch()} retryLabel={t("mobile.retry")} />;

  const days = agendaDays(schedule.data);
  const range = t("jobs.dateRange", { start: formatDay(from, formatLocale), end: formatDay(to, formatLocale) });

  return (
    <>
      <Stack.Screen options={{ title: t("jobs.schedule.title") }} />
      <ScrollView
        contentContainerClassName="gap-section px-gutter pb-section pt-stack"
        refreshControl={<RefreshControl refreshing={schedule.isRefetching} onRefresh={() => void schedule.refetch()} tintColor={spinner} />}
      >
        <Pager
          range={range}
          busy={schedule.isPlaceholderData}
          onEarlier={() => setFrom(addDays(from, -WINDOW_DAYS))}
          onLater={() => setFrom(addDays(from, WINDOW_DAYS))}
          onToday={from === today ? undefined : () => setFrom(today)}
        />
        {days.length === 0 ? (
          <Text className="text-center text-callout text-muted-foreground">{t("jobs.schedule.agendaEmpty", { range })}</Text>
        ) : (
          days.map(({ day, entries }) => (
            <View key={day} className="gap-stack">
              <Text className={`text-label uppercase ${day === today ? "text-brand-ink" : "text-muted-foreground"}`}>
                {day === today ? `${t("jobs.schedule.today")} · ` : ""}
                {formatDayHeading(day, formatLocale)}
              </Text>
              <View className="overflow-hidden rounded-xl border border-border bg-card">
                {entries.map((entry, index) => (
                  <Entry
                    key={entry.kind === "event" ? entry.event.id : `todo-${entry.todo.id}`}
                    entry={entry}
                    first={index === 0}
                    formatLocale={formatLocale}
                    timeZone={timeZone}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

function Pager({
  range,
  busy,
  onEarlier,
  onLater,
  onToday,
}: {
  range: string;
  busy: boolean;
  onEarlier: () => void;
  onLater: () => void;
  onToday?: () => void;
}) {
  const t = useTranslations("jobs.schedule");
  const icon = useColor("brand-ink");

  return (
    <View className="flex-row items-center gap-1">
      <Pressable accessibilityRole="button" accessibilityLabel={t("earlier")} onPress={onEarlier} className="size-12 items-center justify-center rounded-xl active:bg-muted">
        <ChevronLeft size={22} color={icon} />
      </Pressable>
      <View className="flex-1 items-center gap-0.5">
        <Text className={`text-headline text-foreground ${busy ? "opacity-50" : ""}`}>{range}</Text>
        {onToday ? (
          <Pressable accessibilityRole="button" onPress={onToday} hitSlop={8}>
            <Text className="text-footnote font-medium text-brand-ink">{t("today")}</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("later")} onPress={onLater} className="size-12 items-center justify-center rounded-xl active:bg-muted">
        <ChevronRight size={22} color={icon} />
      </Pressable>
    </View>
  );
}

function Entry({ entry, first, formatLocale, timeZone }: { entry: AgendaEntry; first: boolean; formatLocale: string; timeZone: string }) {
  const t = useTranslations();
  const icon = useColor("brand-ink");
  const chevron = useColor("muted-foreground");
  const rule = first ? "" : "border-t border-border";

  if (entry.kind === "todo") {
    return (
      <Link href={{ pathname: "/todos/[id]", params: { id: entry.todo.id } }} asChild>
        <Pressable accessibilityRole="button" className={`min-h-14 flex-row items-center gap-3 px-card-pad py-3 active:bg-muted ${rule}`}>
          <ListChecks size={20} color={icon} />
          <View className="flex-1 gap-0.5">
            <Text className="text-callout text-card-foreground">{entry.todo.title}</Text>
            <Text className="text-footnote text-muted-foreground">{t("jobs.schedule.todoDue")}</Text>
          </View>
          <ChevronRight size={18} color={chevron} />
        </Pressable>
      </Link>
    );
  }

  const { event } = entry;
  const when = [
    entry.multiDay ? t("jobs.dateRange", { start: formatDay(event.startsOn, formatLocale), end: formatDay(event.endsOn, formatLocale) }) : null,
    event.allDay || !event.startsAt
      ? entry.multiDay
        ? null
        : t("jobs.schedule.allDay")
      : [event.startsAt, event.endsAt].filter((iso): iso is string => iso !== null).map((iso) => formatTime(iso, formatLocale, timeZone)).join(" – "),
    entry.continues ? t("mobile.schedule.continues") : null,
  ].filter(Boolean);

  return (
    <View className={`gap-1.5 px-card-pad py-3 ${rule}`}>
      <View className="flex-row items-start gap-2">
        {event.milestone ? <Diamond size={16} color={icon} style={{ marginTop: 3 }} accessibilityLabel={t("jobs.schedule.milestone")} /> : null}
        <Text className="flex-1 text-headline text-card-foreground">{event.title}</Text>
      </View>
      <Text className="text-footnote text-muted-foreground">
        {when.join(" · ")}
        {event.comments ? ` · ${t("jobs.schedule.commentCount", { count: event.comments })}` : ""}
      </Text>
      {event.participants.length ? <AvatarStack people={event.participants} max={5} size={24} /> : null}
    </View>
  );
}
