import { Stack } from "expo-router";
import { useColor } from "@/lib/brand";

/**
 * Everything inside a company: the tabs, and what opens on top of them — a
 * job, its to-dos, one to-do. Native headers, so the back gesture and the
 * large-title behaviour are the platform's own; forms open as sheets.
 */
export default function CompanyLayout() {
  const panel = useColor("panel");
  const foreground = useColor("foreground");
  const tint = useColor("brand-ink");

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: panel },
        headerTintColor: tint,
        headerTitleStyle: { color: foreground },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: panel },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="todos/[id]/edit" options={{ presentation: "modal" }} />
      <Stack.Screen name="todo-lists/[id]/new" options={{ presentation: "modal" }} />
    </Stack>
  );
}
