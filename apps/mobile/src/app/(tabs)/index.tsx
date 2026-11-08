import { Redirect } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { Empty, Failed, Loading, Screen } from "@/components/screen";
import { useColor } from "@/lib/brand";
import { useErrorText } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { can, useJobs, useMe } from "@/lib/queries";
import type { JobSummary } from "@/lib/types";

/**
 * The jobs this person can see, in progress first. Opening one comes with the
 * job screens (Fase 4); this is the list they will open from.
 */
export default function Jobs() {
  const t = useTranslations();
  const errorText = useErrorText();
  const [show, setShow] = useState<"active" | "done">("active");
  const { data: me } = useMe();
  const jobs = useJobs(show);
  const spinner = useColor("muted-foreground");

  // A profile without the jobs tool never sees this tab; the bell is where it lands.
  if (me && !can(me, "jobs.read")) return <Redirect href="/notifications" />;

  return (
    <Screen edges={["top"]}>
      <View className="gap-stack-loose px-gutter pb-stack pt-stack-loose">
        <Text accessibilityRole="header" className="text-title-1 text-foreground">
          {t("jobs.title")}
        </Text>
        <Segmented
          value={show}
          onChange={setShow}
          options={[
            { value: "active", label: t("mobile.jobsList.showActive") },
            { value: "done", label: t("mobile.jobsList.showDone") },
          ]}
        />
      </View>
      {jobs.isPending ? (
        <Loading />
      ) : jobs.isError && !jobs.data ? (
        <Failed text={errorText(jobs.error)} retry={() => jobs.refetch()} retryLabel={t("mobile.retry")} />
      ) : (
        <FlatList
          data={jobs.data?.jobs ?? []}
          keyExtractor={(job) => job.id}
          contentContainerClassName="grow gap-stack px-gutter pb-section"
          refreshControl={<RefreshControl refreshing={jobs.isRefetching} onRefresh={() => void jobs.refetch()} tintColor={spinner} />}
          ListEmptyComponent={<Empty text={t(show === "active" ? "mobile.jobsList.empty" : "jobs.emptyDone")} />}
          renderItem={({ item }) => <JobRow job={item} formatLocale={me?.company.formatLocale ?? "en-NZ"} />}
        />
      )}
    </Screen>
  );
}

function JobRow({ job, formatLocale }: { job: JobSummary; formatLocale: string }) {
  const t = useTranslations("jobs");
  const start = job.startsOn ? formatDay(job.startsOn, formatLocale) : null;
  const end = job.endsOn ? formatDay(job.endsOn, formatLocale) : null;
  const dates =
    start && end ? t("dateRange", { start, end }) : start ? t("startsOnly", { start }) : end ? t("endsOnly", { end }) : t("noDates");

  return (
    <View className="gap-1 rounded-xl border border-border bg-card px-card-pad py-3">
      <Text className="text-headline text-card-foreground" numberOfLines={2}>
        {job.name}
      </Text>
      <Text className="text-footnote text-muted-foreground">
        {t(`status.${job.status}`)} · {dates}
      </Text>
    </View>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <View accessibilityRole="tablist" className="flex-row rounded-xl bg-muted p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            className={`min-h-10 flex-1 items-center justify-center rounded-lg ${selected ? "bg-card" : ""}`}
          >
            <Text className={`text-callout ${selected ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
