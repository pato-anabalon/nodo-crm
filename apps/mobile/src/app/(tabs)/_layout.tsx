import { ICONS } from "@nodo/tokens/shape";
import { Tabs } from "expo-router";
import { Bell, BriefcaseBusiness, UserRound } from "lucide-react-native";
import { useTranslations } from "use-intl";
import { useColor } from "@/lib/brand";
import { can, useInbox, useMe } from "@/lib/queries";

/**
 * Only what the profile lets this person use. The server checks every
 * permission on every request; this only decides what is offered (the jobs
 * tab, missing, sends its screen on to the bell). The clock
 * joins when time control exists, rather than as a tab that does nothing.
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

  return (
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
  );
}
