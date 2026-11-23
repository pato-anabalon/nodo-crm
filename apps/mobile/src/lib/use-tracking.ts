import * as Crypto from "expo-crypto";
import type { NotificationResponse } from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useEffectEvent, useRef } from "react";
import { AppState } from "react-native";
import type { ClockOverview, ClockState, Punch } from "./clock";
import { dismissLeftNotice, syncTracking, trackingAvailable, type MovementData } from "./tracking";
import type { Me } from "./types";

/**
 * Keeps the background tracking on the stretch the clock shows: a new shift,
 * travel, a switch or a clock-out reaches the system as soon as the screen
 * knows it, the queue's own punches included — and again whenever the app
 * comes to the front, which is when a permission given in Settings shows up.
 */
export function useTrackingSync(company: string, me: Me | undefined, overview: ClockOverview | undefined, state: ClockState | null) {
  const sync = useEffectEvent(() => {
    if (!me || !overview || !state) return;
    void syncTracking(
      { company, userId: me.user.id },
      state.kind === "out"
        ? null
        : {
            company,
            userId: me.user.id,
            locale: me.locale,
            formatLocale: me.company.formatLocale,
            timeZone: me.company.timezone,
            entry: state.entry,
            jobId: state.kind === "in" ? state.jobId : null,
            jobName: state.kind === "in" ? state.jobName : state.fromJob,
            jobs: overview.jobs,
            policy: overview.movement,
          },
    );
  });

  const stretch = state && state.kind !== "out" ? `${state.kind}:${state.entry}` : state ? "out" : null;
  const jobs = overview ? JSON.stringify(overview.jobs.map((job) => [job.id, job.site])) : null;
  useEffect(() => sync(), [stretch, jobs, overview?.movement, me?.locale]);

  useEffect(() => {
    if (!trackingAvailable) return;
    const subscription = AppState.addEventListener("change", (next) => next === "active" && sync());
    return () => subscription.remove();
  }, []);
}

/**
 * The buttons on the clock's own notices. "Going to another job" and "Work
 * errand" are queued like a press on the screen; a tap, or "Start here",
 * opens the clock — a switch needs a fix taken now, at the new job.
 */
export function useMovementNotices(company: string, enqueue: (punch: Punch) => void) {
  const handled = useRef(new Set<string>());

  const answer = useEffectEvent((response: NotificationResponse) => {
    const data = response.notification.request.content.data as Partial<MovementData> | null;
    if (!data?.movement || data.company !== company) return;
    // The tap that opened the app arrives twice: as the last response and to the listener.
    const id = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handled.current.has(id)) return;
    handled.current.add(id);

    const at = new Date().toISOString();
    if (data.movement === "left" && data.entry) {
      if (response.actionIdentifier === "travel") enqueue({ kind: "travel", entry: data.entry, clientId: Crypto.randomUUID(), at });
      if (response.actionIdentifier === "errand") enqueue({ kind: "event", entry: data.entry, clientId: Crypto.randomUUID(), event: "ERRAND", at });
      void dismissLeftNotice();
    }
    router.push(data.movement === "switch" && data.jobId ? { pathname: "/clock", params: { switchTo: data.jobId } } : "/clock");
  });

  useEffect(() => {
    if (!trackingAvailable) return;
    let cancelled = false;
    let subscription: { remove(): void } | null = null;
    void import("expo-notifications").then(async (Notifications) => {
      if (cancelled) return;
      subscription = Notifications.addNotificationResponseReceivedListener(answer);
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last && !cancelled && "movement" in (last.notification.request.content.data ?? {})) {
        answer(last);
        await Notifications.clearLastNotificationResponseAsync();
      }
    });
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);
}
