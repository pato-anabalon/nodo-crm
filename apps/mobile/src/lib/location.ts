import * as Battery from "expo-battery";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import type { Fix } from "@nodo/core/timeclock/geofence";

/**
 * Where the phone is, while a screen that needs it is on show — never
 * otherwise. High accuracy, because this is the moment a punch is decided;
 * the shift's own track, between punches, is the background task's and runs
 * on a gentler setting.
 */

export type Permission = "undetermined" | "granted" | "denied";

export function useFix(active: boolean): { fix: Fix | null; permission: Permission; ask: () => Promise<void> } {
  const [fix, setFix] = useState<Fix | null>(null);
  const [permission, setPermission] = useState<Permission>("undetermined");

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then(({ status }) => setPermission(asPermission(status)));
  }, []);

  useEffect(() => {
    if (!active || permission !== "granted") return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 3_000, distanceInterval: 5 },
      ({ coords }) => setFix({ latitude: coords.latitude, longitude: coords.longitude, accuracyM: coords.accuracy ?? 9_999 }),
    ).then((watch) => {
      if (cancelled) watch.remove();
      else subscription = watch;
    });
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [active, permission]);

  return {
    fix,
    permission,
    async ask() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(asPermission(status));
    },
  };
}

/**
 * Location "all the time": what lets the system say the phone left the job
 * with the app closed, and record the track between the punches. Asked only
 * once the foreground one is given, which is the order both systems require;
 * read again whenever the app comes back from Settings.
 */
export function useBackgroundPermission(): { permission: Permission; ask: () => Promise<void> } {
  const [permission, setPermission] = useState<Permission>("undetermined");

  useEffect(() => {
    const read = () => void Location.getBackgroundPermissionsAsync().then(({ status }) => setPermission(asPermission(status)));
    read();
    const subscription = AppState.addEventListener("change", (next) => next === "active" && read());
    return () => subscription.remove();
  }, []);

  return {
    permission,
    async ask() {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      setPermission(asPermission(status));
    },
  };
}

function asPermission(status: Location.PermissionStatus): Permission {
  return status === Location.PermissionStatus.GRANTED ? "granted" : status === Location.PermissionStatus.DENIED ? "denied" : "undetermined";
}

/** 0 to 1, or null where the phone won't say (a simulator answers −1). */
export async function batteryLevel(): Promise<number | null> {
  const level = await Battery.getBatteryLevelAsync().catch(() => -1);
  return level >= 0 && level <= 1 ? level : null;
}
