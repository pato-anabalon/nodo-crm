import { Image } from "expo-image";
import { Link, useLocalSearchParams } from "expo-router";
import { CalendarDays, ChevronRight, FolderOpen, ListChecks, MapPin, Megaphone, MessagesSquare } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { Avatar, AvatarStack } from "@/components/avatars";
import { Failed, Loading } from "@/components/screen";
import { useColor } from "@/lib/brand";
import { useErrorText } from "@/lib/errors";
import { formatDayHeading, formatTime } from "@/lib/format";
import { canOn, useActivity, useJob, useMe, useTodoLists } from "@/lib/queries";
import { timelineDays, useTimeline } from "@/lib/timeline";
import type { ActivityRow, JobDetail } from "@/lib/types";

/**
 * A job: what it is and when, who is on it, the tools this profile may open,
 * and what happened lately — the web's job page, read on a phone.
 */
export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const errorText = useErrorText();
  const job = useJob(id);
  const { data: me } = useMe();
  const spinner = useColor("muted-foreground");
  const formatLocale = me?.company.formatLocale ?? "en-NZ";

  if (job.isPending) return <Loading />;
  if (!job.data) return <Failed text={errorText(job.error)} retry={() => job.refetch()} retryLabel={t("mobile.retry")} />;

  return (
    <ScrollView
      contentContainerClassName="gap-section px-gutter pb-section pt-stack"
      refreshControl={<RefreshControl refreshing={job.isRefetching} onRefresh={() => void job.refetch()} tintColor={spinner} />}
    >
      <Header detail={job.data} formatLocale={formatLocale} />
      <Tools detail={job.data} />
      {canOn(job.data, "jobs.read") ? (
        <Activity detail={job.data} formatLocale={formatLocale} timeZone={me?.company.timezone ?? "UTC"} />
      ) : null}
    </ScrollView>
  );
}

function Header({ detail, formatLocale }: { detail: JobDetail; formatLocale: string }) {
  const t = useTranslations();
  const { job } = detail;
  const { dates } = useTimeline(job.members, formatLocale);
  const pin = useColor("muted-foreground");

  return (
    <View className="gap-stack-loose">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-title-2 text-foreground">
          {job.name}
        </Text>
        <Text className="text-callout text-muted-foreground">
          {t(`jobs.status.${job.status}`)} · {dates(job.startsOn, job.endsOn)}
        </Text>
      </View>
      {job.address ? (
        <View className="flex-row items-start gap-2">
          <MapPin size={16} color={pin} style={{ marginTop: 2 }} />
          <Text className="flex-1 text-callout text-foreground">{job.address}</Text>
        </View>
      ) : null}
      {job.closed ? (
        <View className="rounded-xl bg-muted px-card-pad py-3">
          <Text className="text-callout text-foreground">{t("mobile.job.closed")}</Text>
        </View>
      ) : null}
      <AvatarStack people={job.members} max={6} size={32} />
    </View>
  );
}

/** Only the tools this profile reads; the rest arrive as their screens do. */
function Tools({ detail }: { detail: JobDetail }) {
  const t = useTranslations("jobs");
  const readsTodos = canOn(detail, "todos.read");
  const todos = useTodoLists(readsTodos ? detail.job.id : "");
  const open = todos.data?.lists.reduce((sum, list) => sum + list.open.length, 0);
  const icon = useColor("brand-ink");
  const params = { id: detail.job.id };

  // Basecamp's order, which the people moving over already know.
  const rows = [
    canOn(detail, "messages.read") ? (
      <ToolRow key="board" href={{ pathname: "/jobs/[id]/board", params }} icon={<Megaphone size={22} color={icon} />} title={t("board.title")} />
    ) : null,
    readsTodos ? (
      <ToolRow
        key="todos"
        href={{ pathname: "/jobs/[id]/todos", params }}
        icon={<ListChecks size={22} color={icon} />}
        title={t("todos.title")}
        detail={open === undefined ? undefined : t("todos.openCount", { count: open })}
      />
    ) : null,
    canOn(detail, "files.read") ? (
      <ToolRow key="files" href={{ pathname: "/jobs/[id]/files", params }} icon={<FolderOpen size={22} color={icon} />} title={t("files.title")} />
    ) : null,
    canOn(detail, "chat.read") ? (
      <ToolRow key="chat" href={{ pathname: "/jobs/[id]/chat", params }} icon={<MessagesSquare size={22} color={icon} />} title={t("chat.title")} />
    ) : null,
    canOn(detail, "schedule.read") ? (
      <ToolRow key="schedule" href={{ pathname: "/jobs/[id]/schedule", params }} icon={<CalendarDays size={22} color={icon} />} title={t("schedule.title")} />
    ) : null,
  ].filter((row) => row !== null);

  if (rows.length === 0) return null;

  return (
    <View className="overflow-hidden rounded-xl border border-border bg-card">
      {rows.map((row, index) => (
        <View key={row.key} className={index ? "border-t border-border" : ""}>
          {row}
        </View>
      ))}
    </View>
  );
}

function ToolRow({ href, icon, title, detail }: { href: Parameters<typeof Link>[0]["href"]; icon: ReactNode; title: string; detail?: string }) {
  const chevron = useColor("muted-foreground");
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="button" className="min-h-16 flex-row items-center gap-3 px-card-pad py-3 active:bg-muted">
        {icon}
        <View className="flex-1 gap-0.5">
          <Text className="text-headline text-card-foreground">{title}</Text>
          {detail ? <Text className="text-footnote text-muted-foreground">{detail}</Text> : null}
        </View>
        <ChevronRight size={20} color={chevron} />
      </Pressable>
    </Link>
  );
}

function Activity({ detail, formatLocale, timeZone }: { detail: JobDetail; formatLocale: string; timeZone: string }) {
  const t = useTranslations("jobs.timeline");
  const activity = useActivity(detail.job.id);
  const { describe } = useTimeline(detail.job.members, formatLocale);
  const days = timelineDays(activity.data?.activity ?? [], timeZone);

  return (
    <View className="gap-stack-loose">
      <Text accessibilityRole="header" className="text-title-3 text-foreground">
        {t("title")}
      </Text>
      {activity.isPending ? (
        <Loading />
      ) : days.length === 0 ? (
        <Text className="text-callout text-muted-foreground">{t("empty")}</Text>
      ) : (
        days.map((day) => (
          <View key={day.day} className="gap-stack">
            {/* The silence between days said out loud, as on the web. */}
            {day.quietBefore > 0 ? <Text className="text-footnote italic text-muted-foreground">{t("quiet", { days: day.quietBefore })}</Text> : null}
            <Text className="text-label uppercase text-muted-foreground">{formatDayHeading(day.day, formatLocale)}</Text>
            <View className="gap-stack-loose rounded-xl border border-border bg-card p-card-pad">
              {day.entries.map(({ row }) => (
                <Line key={row.id} row={row} text={describe(row)} time={formatTime(row.createdAt, formatLocale, timeZone)} />
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function Line({ row, text, time }: { row: ActivityRow; text: string; time: string }) {
  return (
    <View className="flex-row gap-3">
      {row.actor ? <Avatar person={row.actor} size={28} /> : <View className="size-7" />}
      <View className="flex-1 gap-1.5">
        <Text className="text-callout text-card-foreground">{text}</Text>
        {row.thumbnails.length ? (
          <View className="flex-row flex-wrap gap-1.5">
            {row.thumbnails.map((url) => (
              <Image key={url} source={url} style={{ width: 56, height: 56, borderRadius: 6 }} contentFit="cover" />
            ))}
          </View>
        ) : null}
        <Text className="text-caption text-muted-foreground">{time}</Text>
      </View>
    </View>
  );
}
