import { ICONS } from "@nodo/tokens/shape";
import { Tabs } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, BriefcaseBusiness, Clock, UserRound } from "lucide-react-native";
import { useCallback } from "react";
import { useTranslations } from "use-intl";
import { useColor } from "@/lib/brand";
import { clockState } from "@/lib/clock";
import { flushPings } from "@/lib/pings";
import { punchKey, usePunchQueue } from "@/lib/punches";
import { can, useClock, useInbox, useMe } from "@/lib/queries";
import { useAuth } from "@/lib/session";
import type { Me } from "@/lib/types";
import { useMovementNotices, useTrackingSync } from "@/lib/use-tracking";

/**
 * Only what the profile lets this person use. The server checks every
 * permission on every request; this only decides what is offered (the jobs
 * tab, missing, sends its screen on to the bell). The clock is there for a
 * profile that punches.
 */
export default function TabsLayout() {
  const t = useTranslations("mobile.tabs");
  const { data: me } = useMe();
  const { data: inbox } = useInbox();
  const active = useColor("primary");
  const idle = useColor("muted-foreground");
  const bar = useColor("card");
  const line = useColor("border");
  const jobs = can(me, "jobs.read");
  const punches = can(me, "timeclock.punch");

  return (
    <>
      {punches ? <ClockKeeper me={me} /> : null}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: active,
          tabBarInactiveTintColor: idle,
          tabBarStyle: { backgroundColor: bar, borderTopColor: line },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("jobs"),
            href: me && !jobs ? null : undefined,
            tabBarIcon: ({ color }) => <BriefcaseBusiness size={ICONS.nav} color={color} />,
          }}
        />
        <Tabs.Screen
          name="clock"
          options={{
            title: t("clock"),
            href: punches ? undefined : null,
            tabBarIcon: ({ color }) => <Clock size={ICONS.nav} color={color} />,
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: t("notifications"),
            tabBarBadge: inbox?.unread ? (inbox.unread > 99 ? "99+" : inbox.unread) : undefined,
            tabBarIcon: ({ color }) => <Bell size={ICONS.nav} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: t("profile"), tabBarIcon: ({ color }) => <UserRound size={ICONS.nav} color={color} /> }}
        />
      </Tabs>
    </>
  );
}

/**
 * The clock whichever tab is open: sends punches waiting for signal — and when
 * the app comes back to the front — not only once somebody opens the clock
 * again; then the positions recorded behind them. Keeps the background
 * tracking on the stretch that is open, and answers the buttons on its notices.
 */
function ClockKeeper({ me }: { me: Me | undefined }) {
  const auth = useAuth();
  const client = useQueryClient();
  const clock = useClock();
  const userId = me?.user.id;
  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: [auth.company, "timeclock"] });
    if (userId) void flushPings(punchKey(auth.company, userId), auth);
  }, [client, auth, userId]);
  const queue = usePunchQueue(auth, userId, refresh);
  const state = clock.data ? clockState(clock.data.open, queue.punches, clock.data.movement) : null;
  useTrackingSync(auth.company, me, clock.data, state);
  useMovementNotices(auth.company, queue.enqueue);
  return null;
}
