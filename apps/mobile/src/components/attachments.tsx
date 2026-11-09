import { Image } from "expo-image";
import { ImagePlus, RotateCcw, Video, X } from "lucide-react-native";
import { ActionSheetIOS, ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { useColor } from "@/lib/brand";
import { useErrorText } from "@/lib/errors";
import { pickMedia, type Attachment } from "@/lib/uploads";
import type { ImagePickerAsset } from "expo-image-picker";

/**
 * The button that adds photos: the camera or the library, asked the way each
 * platform asks — an action sheet on iOS, a dialog on Android. A refused
 * camera says where to allow it rather than doing nothing.
 */
export function AttachButton({ onPicked, disabled }: { onPicked: (assets: ImagePickerAsset[]) => void; disabled?: boolean }) {
  const t = useTranslations("mobile.attach");
  const icon = useColor("brand-ink");

  const pick = async (source: "camera" | "library") => {
    const result = await pickMedia(source);
    if ("denied" in result) {
      Alert.alert(t("cameraDenied"), undefined, [
        { text: t("cancel"), style: "cancel" },
        { text: t("openSettings"), onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    if (result.assets.length) onPicked(result.assets);
  };

  const ask = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [t("camera"), t("library"), t("cancel")], cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) void pick("camera");
          if (index === 1) void pick("library");
        },
      );
      return;
    }
    Alert.alert(t("add"), undefined, [
      { text: t("camera"), onPress: () => void pick("camera") },
      { text: t("library"), onPress: () => void pick("library") },
      { text: t("cancel"), style: "cancel" },
    ]);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("add")}
      disabled={disabled}
      onPress={ask}
      hitSlop={4}
      className={`size-12 items-center justify-center rounded-xl active:bg-muted ${disabled ? "opacity-50" : ""}`}
    >
      <ImagePlus size={24} color={icon} />
    </Pressable>
  );
}

/** What is going up with the message: each with its progress, a way to take it off, and a retry when it failed. */
export function AttachmentStrip({
  items,
  onRemove,
  onRetry,
}: {
  items: Attachment[];
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
}) {
  const errorText = useErrorText();
  const failed = items.find((item) => item.status === "failed");
  if (items.length === 0) return null;

  return (
    <View className="gap-1.5">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 py-1">
        {items.map((item) => (
          <Tile key={item.key} item={item} onRemove={() => onRemove(item.key)} onRetry={() => onRetry(item.key)} />
        ))}
      </ScrollView>
      {failed ? <Text className="text-footnote text-destructive">{errorText(failed.error)}</Text> : null}
    </View>
  );
}

function Tile({ item, onRemove, onRetry }: { item: Attachment; onRemove: () => void; onRetry: () => void }) {
  const t = useTranslations("mobile.attach");
  // Over the photo, where the scrim makes white the one colour that always reads.
  const white = "#ffffff";
  const muted = useColor("muted-foreground");

  return (
    <View className={`size-16 overflow-hidden rounded-lg ${item.status === "failed" ? "border-2 border-destructive" : ""}`}>
      {item.kind === "image" ? (
        <Image source={item.preview} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : (
        <View className="flex-1 items-center justify-center bg-muted">
          <Video size={22} color={muted} />
        </View>
      )}
      {item.status === "uploading" ? (
        <View className="absolute inset-0 items-center justify-center bg-black/40">
          <ActivityIndicator color={white} />
          <View className="absolute bottom-0 left-0 h-1 bg-white" style={{ width: `${Math.round(item.progress * 100)}%` }} />
        </View>
      ) : null}
      {item.status === "failed" ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t("retry")} onPress={onRetry} className="absolute inset-0 items-center justify-center bg-black/40">
          <RotateCcw size={20} color={white} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("remove")}
        onPress={onRemove}
        hitSlop={10}
        className="absolute right-0.5 top-0.5 size-5 items-center justify-center rounded-full bg-black/60"
      >
        <X size={12} color={white} />
      </Pressable>
    </View>
  );
}
