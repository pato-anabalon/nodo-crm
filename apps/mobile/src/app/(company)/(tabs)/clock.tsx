import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { CircleAlert, MapPin, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { shiftMinutes } from "@nodo/core/timeclock/pay";
import type { Fix } from "@nodo/core/timeclock/geofence";
import { Button } from "@/components/button";
import { ErrorText, Failed, Loading, Screen } from "@/components/screen";
import { useColor } from "@/lib/brand";
import { clockState, elapsedSeconds, jobsNearby, stopwatch, type Away, type ClockEntry, type ClockState, type JobNearby } from "@/lib/clock";
import { useErrorText } from "@/lib/errors";
import { formatDayHeading, formatTime } from "@/lib/format";
import { batteryLevel, useBackgroundPermission, useFix } from "@/lib/location";
import { usePunchQueue, type Refusal } from "@/lib/punches";
import { useClock, useClockConsent, useClockEntries, useMe } from "@/lib/queries";
import { useAuth } from "@/lib/session";
import { trackingAvailable } from "@/lib/tracking";

/**
 * Clocking in on site and out at the end of the day. The phone decides on the
 * spot whether it is inside the job's circle — from the circles it keeps, so
 * it works with no signal — and the punch is kept until the server has it.
 * The precise GPS runs only while this screen is on show; between punches the
 * background tracking (`tracking.ts`) watches the job's circle at far less cost.
 *
 * Away from the job it says so and counts down when the company ends shifts
 * by itself, with the errand and the travel at hand; at another job it offers
 * the switch, which a notice may have opened it for (`switchTo`).
 */
export default function Clock() {
  const t = useTranslations("mobile.clock");
  const tMobile = useTranslations("mobile");
  const errorText = useErrorText();
  const auth = useAuth();
  const client = useQueryClient();
  const { data: me } = useMe();
  const clock = useClock();
  const entries = useClockEntries();
  const spinner = useColor("muted-foreground");

  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: [auth.company, "timeclock"] });
  }, [client, auth.company]);
  const queue = usePunchQueue(auth, me?.user.id, refresh);
  const state = clockState(clock.data?.open ?? null, queue.punches, clock.data?.movement);
  const { fix, permission, ask } = useFix(focused && Boolean(clock.data?.consentAt));
  const background = useBackgroundPermission();
  const { switchTo } = useLocalSearchParams<{ switchTo?: string }>();

  if (clock.isPending) {
    return (
      <Screen edges={["top"]}>
        <Loading />
      </Screen>
    );
  }
  if (clock.isError && !clock.data) {
    return (
      <Screen edges={["top"]}>
        <Failed text={errorText(clock.error)} retry={() => clock.refetch()} retryLabel={tMobile("retry")} />
      </Screen>
    );
  }

  const overview = clock.data!;
  const formatLocale = me?.company.formatLocale ?? "en-NZ";
  const timeZone = me?.company.timezone ?? "Pacific/Auckland";
  const nearby = jobsNearby(overview.jobs, fix);
  const currentJob = state.kind === "in" ? state.jobId : null;
  // Where they've arrived: the job a notice named if the phone agrees it's there, otherwise the nearest one inside.
  const inside = nearby.filter((job) => job.verdict?.kind === "inside" && job.id !== currentJob);
  const arrivedAt = inside.find((job) => job.id === switchTo) ?? inside[0] ?? null;
  const now = () => new Date().toISOString();
  const startHere = async (job: JobNearby) => {
    if (!fix || state.kind === "out") return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    queue.enqueue({ kind: "switch", from: state.entry, clientId: Crypto.randomUUID(), jobId: job.id, jobName: job.name, at: now(), fix, battery: await batteryLevel() });
  };
  const clockOut = async () => {
    if (state.kind === "out") return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    queue.enqueue({ kind: "out", entry: state.entry, at: now(), fix, battery: await batteryLevel() });
  };

  return (
    <Screen edges={["top"]}>
      <ScrollView
        contentContainerClassName="gap-section px-gutter pb-section pt-stack-loose"
        refreshControl={<RefreshControl refreshing={clock.isRefetching} onRefresh={() => (queue.retry(), refresh())} tintColor={spinner} />}
      >
        <Text accessibilityRole="header" className="text-title-1 text-foreground">
          {t("title")}
        </Text>

        {queue.refusal ? <RefusalNotice refusal={queue.refusal} onDismiss={queue.dismissRefusal} /> : null}
        {queue.punches.length > 0 ? (
          <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2 rounded-xl bg-muted px-card-pad py-3">
            <CircleAlert size={18} color={spinner} />
            <Text className="flex-1 text-callout text-foreground">{t("waiting", { count: queue.punches.length })}</Text>
          </View>
        ) : null}

        {overview.consentAt && permission === "granted" && trackingAvailable && background.permission !== "granted" ? (
          <BackgroundPermission denied={background.permission === "denied"} onAsk={background.ask} />
        ) : null}

        {!overview.consentAt ? (
          <Consent days={overview.retentionDays} />
        ) : permission !== "granted" ? (
          <LocationPermission denied={permission === "denied"} onAsk={ask} />
        ) : state.kind === "in" ? (
          <>
            {arrivedAt ? <SwitchOffer job={arrivedAt} from={state.jobName} onSwitch={() => startHere(arrivedAt)} /> : null}
            <OnShift
              state={state}
              formatLocale={formatLocale}
              timeZone={timeZone}
              onClockOut={clockOut}
              onErrand={() => {
                void Haptics.selectionAsync();
                queue.enqueue({ kind: "event", entry: state.entry, clientId: Crypto.randomUUID(), event: "ERRAND", at: now() });
              }}
              onTravel={() => {
                void Haptics.selectionAsync();
                queue.enqueue({ kind: "travel", entry: state.entry, clientId: Crypto.randomUUID(), at: now() });
              }}
            />
          </>
        ) : state.kind === "travel" ? (
          <Travel state={state} formatLocale={formatLocale} timeZone={timeZone} onClockOut={clockOut}>
            <ClockIn jobs={nearby} fix={fix} actionLabel={t("travel.start")} onClockIn={startHere} />
          </Travel>
        ) : (
          <ClockIn
            jobs={nearby}
            fix={fix}
            onClockIn={async (job) => {
              if (!fix) return;
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              queue.enqueue({
                kind: "in",
                clientId: Crypto.randomUUID(),
                jobId: job.id,
                jobName: job.name,
                at: new Date().toISOString(),
                fix,
                battery: await batteryLevel(),
              });
            }}
          />
        )}

        <Week entries={entries.data?.entries ?? []} formatLocale={formatLocale} timeZone={timeZone} />
      </ScrollView>
    </Screen>
  );
}

/** What is recorded, when and for how long — said before anything is, and agreed to once per company. */
function Consent({ days }: { days: number }) {
  const t = useTranslations("mobile.clock.consent");
  const errorText = useErrorText();
  const consent = useClockConsent();

  return (
    <View className="gap-stack-loose rounded-xl border border-border bg-card p-card-pad">
      <Text className="text-headline text-card-foreground">{t("title")}</Text>
      <View className="gap-stack">
        {(["what", "when", "who", "keep"] as const).map((point) => (
          <View key={point} className="flex-row gap-2">
            <Text className="text-callout text-muted-foreground">•</Text>
            <Text className="flex-1 text-callout text-card-foreground">{point === "keep" ? t(point, { days }) : t(point)}</Text>
          </View>
        ))}
      </View>
      <ErrorText>{consent.isError ? errorText(consent.error) : null}</ErrorText>
      <Button label={t("agree")} busy={consent.isPending} onPress={() => consent.mutate(true)} />
    </View>
  );
}

function LocationPermission({ denied, onAsk }: { denied: boolean; onAsk: () => Promise<void> }) {
  const t = useTranslations("mobile.clock.permission");
  return (
    <View className="gap-stack-loose rounded-xl border border-border bg-card p-card-pad">
      <Text className="text-headline text-card-foreground">{t("title")}</Text>
      <Text className="text-callout text-muted-foreground">{t(denied ? "denied" : "why")}</Text>
      {/* Once refused, only the phone's settings can give it back. */}
      <Button label={t(denied ? "openSettings" : "allow")} onPress={() => (denied ? void Linking.openSettings() : void onAsk())} />
    </View>
  );
}

/** Needed for the circle's crossings and the track; the clock still works without it, the screen says what's lost. */
function BackgroundPermission({ denied, onAsk }: { denied: boolean; onAsk: () => Promise<void> }) {
  const t = useTranslations("mobile.clock.background");
  return (
    <View className="gap-stack rounded-xl border border-border bg-card p-card-pad">
      <Text className="text-headline text-card-foreground">{t("title")}</Text>
      <Text className="text-callout text-muted-foreground">{t(denied ? "denied" : "why")}</Text>
      <Button label={t(denied ? "openSettings" : "allow")} onPress={() => (denied ? void Linking.openSettings() : void onAsk())} />
    </View>
  );
}

function ClockIn({
  jobs,
  fix,
  onClockIn,
  actionLabel,
}: {
  jobs: JobNearby[];
  fix: Fix | null;
  onClockIn: (job: JobNearby) => Promise<void>;
  actionLabel?: string;
}) {
  const t = useTranslations("mobile.clock");
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The nearest job inside its circle is the one meant, unless somebody picked another.
  const suggested = jobs.find((job) => job.verdict?.kind === "inside")?.id ?? null;
  const job = jobs.find((candidate) => candidate.id === (chosen ?? suggested)) ?? null;

  if (jobs.length === 0) {
    return <Text className="text-callout text-muted-foreground">{t("noJobs")}</Text>;
  }

  return (
    <View className="gap-stack-loose">
      <Text className="text-callout text-muted-foreground">{fix ? t("accuracy", { metres: Math.round(fix.accuracyM) }) : t("locating")}</Text>

      <View accessibilityRole="radiogroup" className="gap-stack">
        {jobs.map((candidate) => (
          <JobChoice key={candidate.id} job={candidate} selected={candidate.id === job?.id} onPress={() => setChosen(candidate.id)} />
        ))}
      </View>

      {job ? <Verdict job={job} /> : <Text className="text-callout text-muted-foreground">{t("choose")}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: job?.verdict?.kind !== "inside" || busy }}
        disabled={job?.verdict?.kind !== "inside" || busy}
        onPress={async () => {
          if (!job) return;
          setBusy(true);
          await onClockIn(job);
          setBusy(false);
        }}
        className={`min-h-16 items-center justify-center rounded-2xl bg-primary ${job?.verdict?.kind === "inside" ? "" : "opacity-50"}`}
      >
        <Text className="text-title-3 text-primary-foreground">{actionLabel ?? t("clockIn")}</Text>
      </Pressable>
    </View>
  );
}

function JobChoice({ job, selected, onPress }: { job: JobNearby; selected: boolean; onPress: () => void }) {
  const t = useTranslations("mobile.clock");
  const pin = useColor(selected ? "primary" : "muted-foreground");
  const distance = job.verdict && job.verdict.kind !== "no-site" ? distanceLabel(job.verdict.distanceM, t) : null;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={`min-h-12 flex-row items-center gap-3 rounded-xl border bg-card px-card-pad py-3 ${selected ? "border-primary" : "border-border"}`}
    >
      <MapPin size={20} color={pin} />
      <View className="flex-1 gap-0.5">
        <Text className="text-callout font-semibold text-card-foreground" numberOfLines={2}>
          {job.name}
        </Text>
        {job.site ? null : <Text className="text-footnote text-muted-foreground">{t("noSite")}</Text>}
      </View>
      {distance ? <Text className="text-footnote tabular-nums text-muted-foreground">{distance}</Text> : null}
    </Pressable>
  );
}

/** Why the button is or isn't there to press, in words. */
function Verdict({ job }: { job: JobNearby }) {
  const t = useTranslations("mobile.clock.verdict");
  const verdict = job.verdict;
  if (!verdict) return <Text className="text-callout text-muted-foreground">{t("waiting")}</Text>;
  const radius = job.site?.radiusM ?? 0;
  const text =
    verdict.kind === "inside"
      ? t("inside")
      : verdict.kind === "outside"
        ? t("outside", { metres: Math.round(verdict.distanceM), radius })
        : verdict.kind === "imprecise"
          ? t("imprecise")
          : t("noSite");
  return (
    <Text accessibilityLiveRegion="polite" className={`text-callout ${verdict.kind === "inside" ? "text-foreground" : "text-muted-foreground"}`}>
      {text}
    </Text>
  );
}

/** A second hand for whatever runs: the shift, the countdown, the travel. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function OnShift({
  state,
  formatLocale,
  timeZone,
  onClockOut,
  onErrand,
  onTravel,
}: {
  state: Extract<ClockState, { kind: "in" }>;
  formatLocale: string;
  timeZone: string;
  onClockOut: () => Promise<void>;
  onErrand: () => void;
  onTravel: () => void;
}) {
  const t = useTranslations("mobile.clock");
  const now = useNow();

  return (
    <View className="gap-stack-loose rounded-xl border border-border bg-card p-card-pad">
      <View className="gap-1">
        <Text className="text-label uppercase text-muted-foreground">{t("onShift")}</Text>
        <Text className="text-headline text-card-foreground">{state.jobName}</Text>
      </View>
      <Text accessibilityLabel={t("elapsedLabel")} className="text-numeric-xl text-card-foreground">
        {stopwatch(elapsedSeconds(state.since, now))}
      </Text>
      <Text className="text-callout text-muted-foreground">{t("since", { time: formatTime(state.since, formatLocale, timeZone) })}</Text>
      {state.away ? (
        <AwayNotice away={state.away} now={now} formatLocale={formatLocale} timeZone={timeZone} onErrand={onErrand} onTravel={onTravel} />
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          // Ending the day is one press away from a pocket: asked once.
          Alert.alert(t("confirmOut.title"), t("confirmOut.body", { job: state.jobName }), [
            { text: t("confirmOut.cancel"), style: "cancel" },
            { text: t("clockOut"), style: "destructive", onPress: () => void onClockOut() },
          ])
        }
        // The card's own action, so it carries the company's colour: in the pale grey of the buttons
        // beside it, it read as switched off.
        className="min-h-16 items-center justify-center rounded-2xl bg-primary"
      >
        <Text className="text-title-3 text-primary-foreground">{t("clockOut")}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Out of the job's circle mid-shift: since when, and — when the company ends
 * a shift for it — how long is left before it ends at the moment they left.
 * An errand stops the count; travel ends the shift there and starts the drive.
 */
function AwayNotice({
  away,
  now,
  formatLocale,
  timeZone,
  onErrand,
  onTravel,
}: {
  away: Away;
  now: number;
  formatLocale: string;
  timeZone: string;
  onErrand: () => void;
  onTravel: () => void;
}) {
  const t = useTranslations("mobile.clock.away");
  const left = away.until ? Math.max(0, Math.floor((Date.parse(away.until) - now) / 1000)) : null;
  const icon = useColor(left !== null && !away.errand ? "destructive" : "muted-foreground");
  const leftAt = formatTime(away.leftAt, formatLocale, timeZone);

  return (
    <View accessibilityLiveRegion="polite" className="gap-stack rounded-xl bg-muted p-card-pad">
      <View className="flex-row items-center gap-2">
        <CircleAlert size={18} color={icon} />
        <Text className="flex-1 text-callout font-semibold text-foreground">{t(away.errand ? "errandTitle" : "title")}</Text>
      </View>
      {away.errand ? (
        <Text className="text-callout text-foreground">{t("errandOn", { time: leftAt })}</Text>
      ) : left !== null ? (
        <>
          <Text accessibilityLabel={t("countdownLabel")} className="text-title-1 tabular-nums text-foreground">
            {stopwatch(left)}
          </Text>
          <Text className="text-callout text-foreground">{t("countdown", { time: leftAt })}</Text>
        </>
      ) : (
        <Text className="text-callout text-foreground">{t("noLimit", { time: leftAt })}</Text>
      )}
      <View className="flex-row flex-wrap gap-2">
        {away.errand ? null : (
          <View className="min-w-36 flex-1">
            <Button label={t("errand")} variant="secondary" onPress={onErrand} />
          </View>
        )}
        <View className="min-w-36 flex-1">
          <Button label={t("travel")} variant="secondary" onPress={onTravel} />
        </View>
      </View>
    </View>
  );
}

/** At another job's place: taking it up ends what's open now and starts there, in one press. */
function SwitchOffer({ job, from, onSwitch }: { job: JobNearby; from: string; onSwitch: () => Promise<void> }) {
  const t = useTranslations("mobile.clock.switch");
  const [busy, setBusy] = useState(false);
  return (
    <View className="gap-stack rounded-xl border border-primary bg-card p-card-pad">
      <Text className="text-headline text-card-foreground">{t("title", { job: job.name })}</Text>
      <Text className="text-callout text-muted-foreground">{t("hint", { from })}</Text>
      <Button
        label={t("button")}
        busy={busy}
        onPress={async () => {
          setBusy(true);
          await onSwitch();
          setBusy(false);
        }}
      />
    </View>
  );
}

/** Between jobs: paid, on no job, until they take up the next or it runs out. */
function Travel({
  state,
  formatLocale,
  timeZone,
  onClockOut,
  children,
}: {
  state: Extract<ClockState, { kind: "travel" }>;
  formatLocale: string;
  timeZone: string;
  onClockOut: () => Promise<void>;
  children: ReactNode;
}) {
  const t = useTranslations("mobile.clock");
  const now = useNow();

  return (
    <View className="gap-section">
      <View className="gap-stack-loose rounded-xl border border-border bg-card p-card-pad">
        <View className="gap-1">
          <Text className="text-label uppercase text-muted-foreground">{t("travel.title")}</Text>
          <Text className="text-headline text-card-foreground">{t("travel.from", { job: state.fromJob })}</Text>
        </View>
        <Text accessibilityLabel={t("travel.elapsedLabel")} className="text-numeric-xl text-card-foreground">
          {stopwatch(elapsedSeconds(state.since, now))}
        </Text>
        <Text className="text-callout text-muted-foreground">{t("travel.endsAt", { time: formatTime(state.endsAt, formatLocale, timeZone) })}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert(t("confirmOut.title"), t("travel.confirmBody"), [
              { text: t("confirmOut.cancel"), style: "cancel" },
              { text: t("clockOut"), style: "destructive", onPress: () => void onClockOut() },
            ])
          }
          // Outlined, not filled: on the road the next job is the action, and its button is the coloured one.
          className="min-h-16 items-center justify-center rounded-2xl border-2 border-border bg-card"
        >
          <Text className="text-title-3 text-card-foreground">{t("clockOut")}</Text>
        </Pressable>
      </View>
      <View className="gap-stack">
        <Text className="text-label uppercase text-muted-foreground">{t("travel.choose")}</Text>
        {children}
      </View>
    </View>
  );
}

function RefusalNotice({ refusal, onDismiss }: { refusal: Refusal; onDismiss: () => void }) {
  const t = useTranslations("mobile.clock.refused");
  const icon = useColor("destructive");
  const known = [
    "outside",
    "imprecise",
    "no_site",
    "consent_required",
    "already_clocked_in",
    "job_closed",
    "punch_too_old",
    "punch_in_future",
    "same_job",
    "already_ended",
    "not_on_a_job",
  ];
  const code = known.includes(refusal.code) ? refusal.code : "generic";
  const text = t(code as "generic", {
    metres: Number(refusal.extra.distanceM ?? 0),
    radius: Number(refusal.extra.radiusM ?? 0),
  });

  return (
    <View accessibilityRole="alert" className="flex-row items-start gap-2 rounded-xl border border-destructive bg-card px-card-pad py-3">
      <CircleAlert size={18} color={icon} />
      <Text className="flex-1 text-callout text-card-foreground">{text}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("dismiss")} hitSlop={8} onPress={onDismiss}>
        <X size={18} color={icon} />
      </Pressable>
    </View>
  );
}

/** The last seven days, day by day, as hours on the clock — before breaks; what is paid is the timesheet's. */
function Week({ entries, formatLocale, timeZone }: { entries: ClockEntry[]; formatLocale: string; timeZone: string }) {
  const t = useTranslations("mobile.clock.week");
  const days = useMemo(() => {
    const byDay = new Map<string, ClockEntry[]>();
    for (const entry of entries) {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(entry.clockInAt));
      byDay.set(day, [...(byDay.get(day) ?? []), entry]);
    }
    return [...byDay.entries()];
  }, [entries, timeZone]);

  if (days.length === 0) return null;
  return (
    <View className="gap-stack">
      <Text className="text-label uppercase text-muted-foreground">{t("title")}</Text>
      <View className="rounded-xl border border-border bg-card">
        {days.map(([day, ofDay], index) => {
          const minutes = ofDay.reduce(
            (sum, entry) => sum + (entry.clockOutAt ? shiftMinutes(new Date(entry.clockInAt), new Date(entry.clockOutAt)) : 0),
            0,
          );
          return (
            <View key={day} className={`gap-1 px-card-pad py-3 ${index > 0 ? "border-t border-border" : ""}`}>
              <View className="flex-row items-baseline justify-between gap-2">
                <Text className="text-callout font-semibold text-card-foreground">{formatDayHeading(day, formatLocale)}</Text>
                <Text className="text-callout tabular-nums text-card-foreground">{`${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`}</Text>
              </View>
              {ofDay.map((entry) => (
                <Text key={entry.id} className="text-footnote text-muted-foreground" numberOfLines={1}>
                  {entry.clockOutAt
                    ? t("range", { start: formatTime(entry.clockInAt, formatLocale, timeZone), end: formatTime(entry.clockOutAt, formatLocale, timeZone), job: entry.job.name })
                    : t("open", { start: formatTime(entry.clockInAt, formatLocale, timeZone), job: entry.job.name })}
                </Text>
              ))}
            </View>
          );
        })}
      </View>
      <Text className="text-caption text-muted-foreground">{t("hint")}</Text>
    </View>
  );
}

function distanceLabel(metres: number, t: ReturnType<typeof useTranslations<"mobile.clock">>): string {
  return metres < 1000 ? t("metres", { metres: Math.round(metres) }) : t("kilometres", { km: (metres / 1000).toFixed(1) });
}
