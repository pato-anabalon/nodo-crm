import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useColor } from "@/lib/brand";
import { Button } from "./button";

/** The page every screen sits on: the panel, the safe area, the phone's gutter. */
export function Screen({ children, edges = ["top", "bottom"] }: { children: ReactNode; edges?: Edge[] }) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-panel">
      {children}
    </SafeAreaView>
  );
}

export function Title({ children, subtitle }: { children: string; subtitle?: string }) {
  return (
    <View className="gap-1">
      <Text accessibilityRole="header" className="text-title-1 text-foreground">
        {children}
      </Text>
      {subtitle ? <Text className="text-callout text-muted-foreground">{subtitle}</Text> : null}
    </View>
  );
}

export function Loading() {
  const color = useColor("muted-foreground");
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color={color} />
    </View>
  );
}

/** Empty is a state, not a fault: said plainly, centred, quiet. */
export function Empty({ text }: { text: string }) {
  return (
    <View className="flex-1 items-center justify-center px-gutter py-section">
      <Text className="text-center text-callout text-muted-foreground">{text}</Text>
    </View>
  );
}

/** What went wrong, and the way to try again — never a dead end. */
export function Failed({ text, retry, retryLabel }: { text: string; retry: () => void; retryLabel: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-stack-loose px-gutter py-section">
      <Text className="text-center text-callout text-muted-foreground">{text}</Text>
      <Button label={retryLabel} variant="secondary" onPress={retry} />
    </View>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <Text accessibilityLiveRegion="polite" className="text-callout text-destructive">
      {children}
    </Text>
  );
}
