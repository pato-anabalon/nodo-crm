import { forwardRef, type ComponentRef } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";
import { useColor } from "@/lib/brand";

/**
 * A label that is always visible — a placeholder that vanishes on the first
 * letter leaves nobody sure which box they're in — and its error right
 * under it, where it can be read while the field is fixed. 16pt text, so
 * nothing zooms and it reads at arm's length.
 */
type Props = TextInputProps & { label: string; error?: string };

export const Field = forwardRef<ComponentRef<typeof TextInput>, Props>(function Field({ label, error, ...props }, ref) {
  const placeholder = useColor("muted-foreground");

  return (
    <View className="gap-1.5">
      <Text className="text-footnote font-medium text-foreground">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={placeholder}
        className={`min-h-12 rounded-xl border bg-field px-4 text-body text-foreground ${error ? "border-destructive" : "border-input"}`}
        {...props}
      />
      {error ? <Text className="text-footnote text-destructive">{error}</Text> : null}
    </View>
  );
});
