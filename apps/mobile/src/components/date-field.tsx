import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { X } from "lucide-react-native";
import { Platform, Pressable, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { useColor } from "@/lib/brand";
import { fromDayKey, toDayKey } from "@/lib/days";
import { formatDay } from "@/lib/format";

export function DateField({
  label,
  value,
  onChange,
  formatLocale,
}: {
  label: string;
  value: string | null;
  onChange: (day: string | null) => void;
  formatLocale: string;
}) {
  const t = useTranslations("mobile.job");
  const accent = useColor("primary");
  const clear = useColor("muted-foreground");

  const pick = () => {
    const initial = value ? fromDayKey(value) : new Date();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({ value: initial, mode: "date", onChange: (event, date) => event.type === "set" && date && onChange(toDayKey(date)) });
    } else {
      onChange(toDayKey(initial));
    }
  };

  return (
    <View className="gap-1.5">
      <Text className="text-footnote font-medium text-foreground">{label}</Text>
      <View className="min-h-12 flex-row items-center gap-2">
        {value && Platform.OS === "ios" ? (
          // iOS draws its own compact button that opens the calendar.
          <DateTimePicker
            value={fromDayKey(value)}
            mode="date"
            display="compact"
            accentColor={accent}
            onChange={(_event, date) => date && onChange(toDayKey(date))}
            accessibilityLabel={label}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={pick}
            className="min-h-12 justify-center rounded-xl border border-input bg-field px-4"
          >
            <Text className={`text-body ${value ? "text-foreground" : "text-muted-foreground"}`}>
              {value ? formatDay(value, formatLocale) : t("pickDate")}
            </Text>
          </Pressable>
        )}
        {value ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t("clearDate")} hitSlop={8} onPress={() => onChange(null)} className="size-11 items-center justify-center">
            <X size={20} color={clear} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
