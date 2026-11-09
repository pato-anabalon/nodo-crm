import { Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { useColor } from "@/lib/brand";

/**
 * Everything inside a company: the tabs, and what opens on top of them — a
 * job, its to-dos, one to-do. Native headers, so the back gesture and the
 * large-title behaviour are the platform's own; forms open as sheets.
 *
 * Titles that don't depend on data are set here rather than by the screen, so
 * they show while it loads; the rest start blank, never as the route's file
 * name, until the screen knows what to call itself.
 */
export default function CompanyLayout() {
  const panel = useColor("panel");
  const foreground = useColor("foreground");
  const tint = useColor("brand-ink");
  const t = useTranslations("jobs");

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: panel },
        headerTintColor: tint,
        headerTitleStyle: { color: foreground },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: panel },
        title: "",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="jobs/[id]/board" options={{ title: t("board.title") }} />
      <Stack.Screen name="jobs/[id]/todos" options={{ title: t("todos.title") }} />
      <Stack.Screen name="jobs/[id]/chat" options={{ title: t("chat.title") }} />
      <Stack.Screen name="jobs/[id]/schedule" options={{ title: t("schedule.title") }} />
      <Stack.Screen name="jobs/[id]/files" options={{ title: t("files.title") }} />
      <Stack.Screen name="posts/[id]/index" options={{ title: t("board.title") }} />
      <Stack.Screen name="todos/[id]/edit" options={{ presentation: "modal", title: t("todos.editTodo") }} />
      <Stack.Screen name="todo-lists/[id]/new" options={{ presentation: "modal", title: t("todos.addTodo") }} />
    </Stack>
  );
}
