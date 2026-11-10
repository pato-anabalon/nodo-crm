import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import { router, type Href } from "expo-router";
import { useEffect, useEffectEvent, useRef } from "react";
import { Platform } from "react-native";
import { api } from "./api";
import { appHref } from "./links";
import { queryClient } from "./query";
import { useSession } from "./session";

/**
 * The phone's end of push. The server already raises a push for every notice
 * that reaches the bell (`notifications/push.ts`); here the phone says where
 * to send them (`PUT /push-device`), shows one that arrives while the app is
 * open, and opens what a tapped one is about — in its own company, switching
 * to it first when the person was working in another.
 *
 * Only in a build of our own: Expo Go stopped receiving pushes in SDK 53 (and
 * throws on Android), a simulator has no token to give, and without the EAS
 * project id (`eas init`) there is nowhere to ask for one. In any of those
 * the module isn't even loaded, and the bell works exactly as before.
 */

type PushData = { notificationId?: string; href?: string | null; companySlug?: string };

const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

export const pushAvailable =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && Device.isDevice && projectId !== undefined;

const load = () => import("expo-notifications");

export function usePush(channelName: string) {
  const { state, chooseCompany } = useSession();
  const token = state.status === "signedIn" ? state.token : null;
  const company = state.status === "signedIn" ? state.company : null;
  const companies = state.status === "signedIn" ? state.companies : null;
  // A tap on another company's notice waits here while the switch happens.
  const pending = useRef<PushData | null>(null);

  // Asked once the person is in, and again every start: a token can change, and the same one twice changes nothing.
  useEffect(() => {
    if (!pushAvailable || !token) return;
    void (async () => {
      const Notifications = await load();
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: channelName,
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
      const current = await Notifications.getPermissionsAsync();
      const granted = current.granted || (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
      if (!granted) return;
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      await api("/push-device", { method: "PUT", body: { token: data, platform: Platform.OS }, auth: { token } });
    })().catch(() => undefined);
  }, [token, channelName]);

  const open = useEffectEvent((data: PushData) => {
    if (!token) return;
    if (data.companySlug && data.companySlug !== company) {
      // Only somewhere the person still works; otherwise the notice has nowhere to open.
      if (companies && !companies.some((choice) => choice.slug === data.companySlug)) return;
      pending.current = data;
      void chooseCompany(data.companySlug);
      return;
    }
    if (data.notificationId) {
      void api(`/notifications/${data.notificationId}/read`, { method: "POST", auth: { token, company } })
        .then(() => queryClient.invalidateQueries({ queryKey: [company, "notifications"] }))
        .catch(() => undefined);
    }
    router.push((appHref(data.href) ?? "/notifications") as Href);
  });

  useEffect(() => {
    if (pending.current && pending.current.companySlug === company) {
      const data = pending.current;
      pending.current = null;
      open(data);
    }
  }, [company]);

  useEffect(() => {
    if (!pushAvailable) return;
    let cancelled = false;
    const subscriptions: { remove(): void }[] = [];

    void load().then(async (Notifications) => {
      if (cancelled) return;
      // Open, the notice still shows as a banner; the bell catches up at once rather than at its next poll.
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: true,
        }),
      });
      subscriptions.push(
        Notifications.addNotificationReceivedListener(() => {
          void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[1] === "notifications" });
        }),
        Notifications.addNotificationResponseReceivedListener((response) => {
          open(response.notification.request.content.data as PushData);
        }),
      );
      // The tap that started the app, before anything was listening.
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last && !cancelled) {
        open(last.notification.request.content.data as PushData);
        await Notifications.clearLastNotificationResponseAsync();
      }
    });

    return () => {
      cancelled = true;
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);
}
