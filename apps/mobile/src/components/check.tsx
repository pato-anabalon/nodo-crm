import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useColor } from "@/lib/brand";

/**
 * Ticking a to-do off: a 48pt target around a 26pt box, so a thumb in a glove
 * finds it, and the light impact the moment it changes — the one haptic the
 * to-dos have (`HAPTICS.impact` in the tokens).
 */
export function TodoCheck({
  done,
  label,
  disabled,
  onChange,
}: {
  done: boolean;
  label: string;
  disabled?: boolean;
  onChange: (done: boolean) => void;
}) {
  const ink = useColor("primary-foreground");

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(!done);
      }}
      className="size-12 items-center justify-center"
    >
      <View
        className={`size-[26px] items-center justify-center rounded-md border-2 ${
          done ? "border-primary bg-primary" : "border-input bg-card"
        } ${disabled ? "opacity-50" : ""}`}
      >
        {done ? <Check size={18} strokeWidth={3} color={ink} /> : null}
      </View>
    </Pressable>
  );
}
