import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { geofenceVerdict } from "@nodo/core/timeclock/geofence";
import type { MovementPolicy } from "@nodo/core/timeclock/movement";
import { MOVING_SPEED_MPS, samplingFor, shouldFlush, type Sampling, type SamplingMode } from "@nodo/core/timeclock/sampling";
import type { Auth } from "./api";
import type { ClockJob } from "./clock";
import { formatTime } from "./format";
import { translator, type Locale } from "./i18n";
import { pingFrom, reactTo, regionJobId, regionsFor, watchFor, type Watch } from "./movement";
import { appendPings, flushPings } from "./pings";
import { enqueuePunch, punchKey } from "./punches";
import { storage } from "./storage";

/**
 * The shift while the phone is in a pocket: the system's geofencing says when
 * it crosses a job's circle, with the app closed and next to no battery, and
 * background location records the track between the punches. Both run only
 * while a stretch is open — a shift or travel — and stop at clock-out.
 *
 * - **Leaving the job** queues `LEFT` in the punch queue and shows a notice
 *   with "Going to another job" and "Work errand" on it, and with the time
 *   the shift ends by itself when the company counts down. Coming back queues
 *   `RETURNED` and takes the notice away.
 * - **Arriving at another job** schedules "Start on B?" for the company's
 *   `switchMinutes` later, taken back if they leave before it shows.
 * - **Positions** are kept on the phone and go up in batches; how often one is
 *   recorded follows `samplingFor`, changing only when the situation does.
 *
 * The tasks wake with nothing in memory, so what they need — the stretch, the
 * circles, the company's rules, the person's language — is written down by
 * the screen whenever the clock changes (`syncTracking`). Only in a build of
 * our own: Expo Go runs neither task.
 */

export const trackingAvailable = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

const GEOFENCE_TASK = "nodo.geofence";
const TRACK_TASK = "nodo.track";
const STORAGE_KEY = "nodo.tracking";
const CHANNEL = "clock";
const LEFT_CATEGORY = "nodo.left";
const SWITCH_CATEGORY = "nodo.switch";
const LEFT_NOTICE = "nodo.left";
const switchNotice = (jobId: string) => `nodo.switch.${jobId}`;

/** What the person sees and the clock acts on; written once per stretch, read by the tasks. */
export type TrackingStretch = {
  company: string;
  userId: string;
  locale: Locale;
  formatLocale: string;
  timeZone: string;
  /** The clientId of the open stretch. */
  entry: string;
  /** The shift's job; null while travelling. */
  jobId: string | null;
  /** The shift's job, or the one travel left. */
  jobName: string;
  jobs: ClockJob[];
  policy: MovementPolicy;
};

type Tracking = TrackingStretch & { watch: Watch; mode: SamplingMode | null };

/** The data a movement notice carries, for the tap or the button that answers it. */
export type MovementData = { movement: "left" | "switch"; company: string; entry?: string; jobId?: string };

let chain: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = chain.then(work, work);
  chain = next.catch(() => undefined);
  return next;
}

async function readTracking(): Promise<Tracking | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  return raw ? (JSON.parse(raw) as Tracking) : null;
}

const writeTracking = (tracking: Tracking | null) =>
  tracking ? AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tracking)) : AsyncStorage.removeItem(STORAGE_KEY);

async function authFor(tracking: Tracking): Promise<Auth | null> {
  const token = await storage.token().catch(() => null);
  return token ? { token, company: tracking.company } : null;
}

const notifications = () => import("expo-notifications");

let lastSignature: string | null = null;

/**
 * Hands the open stretch to the system, or stops everything when there is
 * none. Called by the screen whenever the clock or the permission may have
 * changed; the same stretch twice changes nothing. Somebody between two
 * companies isn't stopped by the one they're not on shift at: only nothing
 * open at the company being tracked stops it.
 */
export function syncTracking(owner: { company: string; userId: string }, next: TrackingStretch | null): Promise<void> {
  if (!trackingAvailable) return Promise.resolve();
  return serial(async () => {
    const background = (await Location.getBackgroundPermissionsAsync().catch(() => null))?.granted ?? false;
    const signature = JSON.stringify([owner, next && { ...next, jobs: next.jobs.map((job) => [job.id, job.site]) }, background]);
    if (signature === lastSignature) return;
    lastSignature = signature;

    const before = await readTracking();
    if (!next) {
      if (before && before.userId === owner.userId && before.company !== owner.company) return;
      await stopAll();
      return;
    }
    if (!background) {
      await stopAll();
      return;
    }

    const same = before?.entry === next.entry && before.company === next.company && before.userId === next.userId;
    if (!same) await clearNotices();
    const tracking: Tracking = { ...next, watch: same ? before!.watch : watchFor(next.entry, next.jobId), mode: same ? before!.mode : null };
    await setUpNotices(next.locale);

    // Travel has no job to centre on: the circles nearest to where the phone last was.
    const near = next.jobId ? null : ((await Location.getLastKnownPositionAsync().catch(() => null))?.coords ?? null);
    const regions = regionsFor(next.jobs, next.jobId, near);
    if (regions.length > 0) await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    else if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) await Location.stopGeofencingAsync(GEOFENCE_TASK);

    if (!tracking.mode || !(await Location.hasStartedLocationUpdatesAsync(TRACK_TASK))) {
      // On the job it starts still; travel starts on the move.
      const sampling = samplingFor({ inside: next.jobId !== null, speedMps: next.jobId ? null : MOVING_SPEED_MPS });
      if (await startTrack(sampling, next.locale)) tracking.mode = sampling.mode;
    }
    await writeTracking(tracking);
  });
}

/** Signing out: whatever was tracked belongs to somebody no longer here. */
export function stopTracking(): Promise<void> {
  if (!trackingAvailable) return Promise.resolve();
  return serial(async () => {
    lastSignature = null;
    await stopAll();
  });
}

async function stopAll() {
  if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false)) await Location.stopGeofencingAsync(GEOFENCE_TASK);
  if (await Location.hasStartedLocationUpdatesAsync(TRACK_TASK).catch(() => false)) await Location.stopLocationUpdatesAsync(TRACK_TASK);
  await clearNotices();
  await writeTracking(null);
}

/**
 * Balanced precision always (wifi and towers). iOS follows the distance and
 * not the interval, so a phone sitting still on site records next to nothing,
 * which is the point; Android follows both, and shows the notice a
 * foreground service has to. False when the system wouldn't take the change —
 * the mode then stays what it was and is tried again with the next position.
 */
async function startTrack(sampling: Sampling, locale: Locale): Promise<boolean> {
  const t = translator(locale);
  try {
    await Location.startLocationUpdatesAsync(TRACK_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: sampling.intervalMs,
      distanceInterval: sampling.distanceM,
      deferredUpdatesInterval: sampling.intervalMs,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
      foregroundService: {
        notificationTitle: t("mobile.clock.movement.trackingTitle"),
        notificationBody: t("mobile.clock.movement.trackingBody"),
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch {
    return false;
  }
}

let noticesReady: Locale | null = null;

async function setUpNotices(locale: Locale) {
  if (noticesReady === locale) return;
  const Notifications = await notifications();
  const t = translator(locale);
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: t("mobile.clock.movement.channel"),
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  // Each button opens the app, so what it does happens where it can be seen and put right.
  await Notifications.setNotificationCategoryAsync(LEFT_CATEGORY, [
    { identifier: "travel", buttonTitle: t("mobile.clock.away.travel"), options: { opensAppToForeground: true } },
    { identifier: "errand", buttonTitle: t("mobile.clock.away.errand"), options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync(SWITCH_CATEGORY, [
    { identifier: "switch", buttonTitle: t("mobile.clock.movement.switchAction"), options: { opensAppToForeground: true } },
  ]);
  noticesReady = locale;
}

async function clearNotices() {
  const Notifications = await notifications();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(switchNotice("")))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
  const shown = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  await Promise.all(
    shown
      .filter((notice) => notice.request.identifier === LEFT_NOTICE || notice.request.identifier.startsWith(switchNotice("")))
      .map((notice) => Notifications.dismissNotificationAsync(notice.request.identifier)),
  );
}

/** Takes away the notice about leaving, once it has been answered or they're back. */
export async function dismissLeftNotice(): Promise<void> {
  if (!trackingAvailable) return;
  await (await notifications()).dismissNotificationAsync(LEFT_NOTICE).catch(() => undefined);
}

async function onCrossing(identifier: string | undefined, entered: boolean) {
  const jobId = regionJobId(identifier);
  if (!jobId) return;
  const found = await serial(async () => {
    const tracking = await readTracking();
    if (!tracking) return null;
    const { watch, reaction } = reactTo(tracking.watch, { jobId, entered });
    const updated = { ...tracking, watch };
    await writeTracking(updated);
    return { tracking: updated, reaction };
  });
  if (!found) return;
  const { tracking, reaction } = found;
  const t = translator(tracking.locale);
  const Notifications = await notifications();
  const at = new Date();
  const data = (extra: Partial<MovementData>): MovementData => ({ movement: "left", company: tracking.company, ...extra });

  if (reaction.event) {
    const key = punchKey(tracking.company, tracking.userId);
    await enqueuePunch(key, { kind: "event", entry: tracking.entry, clientId: Crypto.randomUUID(), event: reaction.event, at: at.toISOString() }, await authFor(tracking));
  }
  if (reaction.event === "LEFT") {
    const minutes = tracking.policy.returnMinutes;
    const until = new Date(at.getTime() + minutes * 60_000).toISOString();
    await Notifications.scheduleNotificationAsync({
      identifier: LEFT_NOTICE,
      content: {
        title: t("mobile.clock.movement.leftTitle", { job: tracking.jobName }),
        body:
          minutes > 0
            ? t("mobile.clock.movement.leftCountdown", { time: formatTime(until, tracking.formatLocale, tracking.timeZone) })
            : t("mobile.clock.movement.leftBody"),
        categoryIdentifier: LEFT_CATEGORY,
        data: data({ entry: tracking.entry }),
      },
      trigger: Platform.OS === "android" ? { channelId: CHANNEL } : null,
    });
  }
  if (reaction.event === "RETURNED") await Notifications.dismissNotificationAsync(LEFT_NOTICE).catch(() => undefined);

  if (reaction.suggest) {
    const job = tracking.jobs.find((candidate) => candidate.id === reaction.suggest);
    const minutes = tracking.policy.switchMinutes;
    if (job) {
      await Notifications.scheduleNotificationAsync({
        identifier: switchNotice(job.id),
        content: {
          title: t("mobile.clock.movement.switchTitle", { job: job.name }),
          body: t("mobile.clock.movement.switchBody", { job: job.name, minutes }),
          categoryIdentifier: SWITCH_CATEGORY,
          data: data({ movement: "switch", jobId: job.id }),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(60, minutes * 60), channelId: CHANNEL },
      });
    }
  }
  if (reaction.withdraw) {
    await Notifications.cancelScheduledNotificationAsync(switchNotice(reaction.withdraw)).catch(() => undefined);
    await Notifications.dismissNotificationAsync(switchNotice(reaction.withdraw)).catch(() => undefined);
  }
}

async function onPositions(locations: Location.LocationObject[]) {
  if (locations.length === 0) return;
  const tracking = await serial(readTracking);
  if (!tracking) return;
  const key = punchKey(tracking.company, tracking.userId);
  const { queued, oldestAt } = await appendPings(key, locations.map((location) => pingFrom(tracking.entry, location)));

  const last = locations[locations.length - 1].coords;
  const site = tracking.jobs.find((job) => job.id === tracking.jobId)?.site ?? null;
  const inside =
    site !== null &&
    geofenceVerdict(site, site.radiusM, { latitude: last.latitude, longitude: last.longitude, accuracyM: last.accuracy ?? 9_999 }).kind === "inside";
  const sampling = samplingFor({ inside, speedMps: last.speed !== null && last.speed >= 0 ? last.speed : null });
  if (sampling.mode !== tracking.mode && (await startTrack(sampling, tracking.locale))) {
    await serial(async () => {
      const current = await readTracking();
      if (current?.entry === tracking.entry) await writeTracking({ ...current, mode: sampling.mode });
    });
  }

  if (shouldFlush({ queued, oldestQueuedAt: oldestAt, now: new Date(), clockingOut: false })) {
    const auth = await authFor(tracking);
    if (auth) await flushPings(key, auth);
  }
}

// Defined when the module is first read, which has to be at the app's start:
// a task woken with the app closed looks for its handler before any screen exists.
if (trackingAvailable) {
  TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(GEOFENCE_TASK, async ({ data, error }) => {
    if (error || !data) return;
    await onCrossing(data.region.identifier, data.eventType === Location.GeofencingEventType.Enter);
  });
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRACK_TASK, async ({ data, error }) => {
    if (error || !data) return;
    await onPositions(data.locations);
  });
}
