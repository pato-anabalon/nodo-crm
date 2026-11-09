import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { FileText } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useColor } from "@/lib/brand";
import type { JobFile } from "@/lib/types";

/**
 * Attachments: a photo or a PDF by its thumbnail (the 480px copy — the original
 * is only fetched when opened), anything else by its name. Opening uses the
 * phone's own viewer through an in-app browser, which reads PDFs, Office files
 * and video without the app having to.
 */
export function FileGrid({ files }: { files: JobFile[] }) {
  if (files.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-2">
      {files.map((file) => (
        <FileTile key={file.id} file={file} />
      ))}
    </View>
  );
}

function FileTile({ file }: { file: JobFile }) {
  const icon = useColor("muted-foreground");
  const open = () => void WebBrowser.openBrowserAsync(file.url);

  if (file.thumbnailUrl) {
    return (
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={file.name} onPress={open} className="active:opacity-80">
        <Image source={file.thumbnailUrl} style={{ width: 96, height: 96, borderRadius: 10 }} contentFit="cover" />
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={open}
      className="h-24 w-24 items-center justify-center gap-1.5 rounded-lg border border-border bg-muted p-2 active:opacity-80"
    >
      <FileText size={22} color={icon} />
      <Text className="text-center text-caption text-foreground" numberOfLines={2}>
        {file.name}
      </Text>
    </Pressable>
  );
}
