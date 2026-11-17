import { ICONS } from "@nodo/tokens/shape";
import { Tabs } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, BriefcaseBusiness, Clock, UserRound } from "lucide-react-native";
import { useCallback } from "react";
import { useTranslations } from "use-intl";
import { useColor } from "@/lib/brand";
import { usePunchQueue } from "@/lib/punches";
import { can, useInbox, useMe } from "@/lib/queries";
import { useAuth } from "@/lib/session";

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
      {punches ? <PunchSender userId={me?.user.id} /> : null}
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
 * Sends punches waiting for signal whichever tab is open — and when the app
 * comes back to the front — not only once somebody opens the clock again.
 */
function PunchSender({ userId }: { userId: string | undefined }) {
  const auth = useAuth();
  const client = useQueryClient();
  const refresh = useCallback(() => void client.invalidateQueries({ queryKey: [auth.company, "timeclock"] }), [client, auth.company]);
  usePunchQueue(auth, userId, refresh);
  return null;
}
