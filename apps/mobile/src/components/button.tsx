import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";
import { PRESS_SCALE } from "@nodo/tokens/motion";
import { useColor } from "@/lib/brand";

/**
 * 48 tall — the app's ordinary target, for gloves and dirty hands — and it
 * answers the moment it's pressed, not when it's let go. Busy keeps its
 * width and reads as such to a screen reader.
 */
type Props = Omit<PressableProps, "children"> & {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  busy?: boolean;
};

const SURFACE = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  ghost: "bg-transparent",
} as const;

const INK = {
  primary: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  ghost: "text-brand-ink",
} as const;

export function Button({ label, variant = "primary", busy = false, disabled, ...props }: Props) {
  const spinner = useColor(variant === "primary" ? "primary-foreground" : "foreground");
  const off = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy }}
      disabled={off}
      className={`min-h-12 flex-row items-center justify-center rounded-xl px-5 ${SURFACE[variant]} ${off ? "opacity-60" : ""}`}
      style={({ pressed }) => (pressed ? { transform: [{ scale: PRESS_SCALE }] } : undefined)}
      {...props}
    >
      {busy ? <ActivityIndicator color={spinner} /> : <Text className={`text-headline ${INK[variant]}`}>{label}</Text>}
    </Pressable>
  );
}
