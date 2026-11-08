import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button } from "@/components/button";
import { Empty, Failed, Loading, Screen } from "@/components/screen";
import { useColor } from "@/lib/brand";
import { useErrorText } from "@/lib/errors";
import { useElapsed } from "@/lib/format";
import { useInbox, useMarkRead, useMe } from "@/lib/queries";
import type { Notice } from "@/lib/types";

/**
 * The bell. Each notice arrives as its kind and parameters and is worded here
 * with the same `notifications.inApp` message the web renders, in this
 * person's language. Opening what it points at comes with the job screens.
 */
export default function Notifications() {
  const t = useTranslations("mobile");
  const errorText = useErrorText();
  const inbox = useInbox();
  const markRead = useMarkRead();
  const { data: me } = useMe();
  const spinner = useColor("muted-foreground");
  const ago = useElapsed(me?.company.formatLocale ?? "en-NZ", me?.company.timezone ?? "UTC");

  return (
    <Screen edges={["top"]}>
      <View className="flex-row items-center justify-between gap-stack px-gutter pb-stack pt-stack-loose">
        <Text accessibilityRole="header" className="text-title-1 text-foreground">
          {t("tabs.notifications")}
        </Text>
        {inbox.data?.unread ? <Button label={t("notificationsList.markAllRead")} variant="ghost" onPress={() => markRead.mutate("all")} /> : null}
      </View>
      {inbox.isPending ? (
        <Loading />
      ) : inbox.isError && !inbox.data ? (
        <Failed text={errorText(inbox.error)} retry={() => inbox.refetch()} retryLabel={t("retry")} />
      ) : (
        <FlatList
          data={inbox.data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerClassName="grow pb-section"
          refreshControl={<RefreshControl refreshing={inbox.isRefetching} onRefresh={() => void inbox.refetch()} tintColor={spinner} />}
          ListEmptyComponent={<Empty text={t("notificationsList.empty")} />}
          ItemSeparatorComponent={() => <View className="ml-gutter h-px bg-border" />}
          renderItem={({ item }) => (
            <NoticeRow notice={item} ago={ago(item.createdAt)} onPress={() => !item.read && markRead.mutate(item.id)} />
          )}
        />
      )}
    </Screen>
  );
}

function NoticeRow({ notice, ago, onPress }: { notice: Notice; ago: string; onPress: () => void }) {
  const t = useTranslations("notifications.inApp");

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-16 flex-row items-start gap-3 px-gutter py-3 active:bg-muted"
    >
      {/* Unread is a dot and a weight, never colour alone. */}
      <View className={`mt-2 size-2 rounded-full ${notice.read ? "bg-transparent" : "bg-primary"}`} />
      <View className="flex-1 gap-0.5">
        <Text className={`text-callout text-foreground ${notice.read ? "" : "font-semibold"}`}>
          {t(notice.kind as "LEAD_RECEIVED", notice.params)}
        </Text>
        <Text className="text-caption text-muted-foreground">{ago}</Text>
      </View>
    </Pressable>
  );
}
