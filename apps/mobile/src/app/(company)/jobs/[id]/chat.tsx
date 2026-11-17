import type { ChatSegment } from "@nodo/core/jobs/chat/text";
import * as WebBrowser from "expo-web-browser";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowUp } from "lucide-react-native";
import { memo, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { AttachButton, AttachmentStrip } from "@/components/attachments";
import { Avatar, personName } from "@/components/avatars";
import { FileGrid } from "@/components/files";
import { Empty, ErrorText, Failed, Loading } from "@/components/screen";
import { useColor } from "@/lib/brand";
import { chatItems, insertMention, mentionCandidates, type ChatItem } from "@/lib/chat";
import { useErrorText } from "@/lib/errors";
import { formatDayHeading, formatTime } from "@/lib/format";
import { canOn, useChat, useDeleteChat, useJob, useMe, useSendChat } from "@/lib/queries";
import { useAttachments } from "@/lib/uploads";
import { MAX_CHAT_LENGTH } from "@nodo/core/jobs/chat/text";
import type { Person } from "@/lib/types";

/**
 * The job's chat: quick talk, in plain text with links and mentions, and
 * photos from the camera. Newest at the bottom by the box, older pages as it
 * scrolls up; it polls while it's on screen, the same way the web's tab does.
 * On a touch screen Enter is a new line and the button sends.
 */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const errorText = useErrorText();
  const [live, setLive] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setLive(true);
      return () => setLive(false);
    }, []),
  );

  const job = useJob(id);
  const chat = useChat(id, live);
  const { data: me } = useMe();
  const remove = useDeleteChat(id);
  const timeZone = me?.company.timezone ?? "UTC";
  const formatLocale = me?.company.formatLocale ?? "en-NZ";
  const items = useMemo(() => chatItems(chat.data, timeZone), [chat.data, timeZone]);
  const spinner = useColor("muted-foreground");

  const confirmDelete = useCallback(
    (messageId: string) =>
      Alert.alert(t("jobs.chat.deleteTitle"), t("jobs.chat.deleteBody"), [
        { text: t("mobile.attach.cancel"), style: "cancel" },
        { text: t("jobs.chat.deleteMessage"), style: "destructive", onPress: () => remove.mutate(messageId) },
      ]),
    [remove, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatItem }) => (
      <Message
        item={item}
        mine={item.message.author?.id === me?.user.id}
        formatLocale={formatLocale}
        timeZone={timeZone}
        onDelete={confirmDelete}
      />
    ),
    [me?.user.id, formatLocale, timeZone, confirmDelete],
  );

  if (chat.isPending) return <Loading />;
  if (!chat.data) return <Failed text={errorText(chat.error)} retry={() => chat.refetch()} retryLabel={t("mobile.retry")} />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100} className="flex-1">
      {items.length === 0 ? (
        <Empty text={t("jobs.chat.empty")} />
      ) : (
        <FlatList
          inverted
          data={items}
          keyExtractor={(item) => item.message.id}
          renderItem={renderItem}
          contentContainerClassName="px-gutter py-stack"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (chat.hasNextPage && !chat.isFetchingNextPage) void chat.fetchNextPage();
          }}
          ListFooterComponent={chat.isFetchingNextPage ? <ActivityIndicator color={spinner} className="py-stack" /> : undefined}
        />
      )}
      <ErrorText>{remove.error ? errorText(remove.error) : null}</ErrorText>
      {canOn(job.data, "chat.create") ? (
        <Composer jobId={id} people={job.data?.job.members ?? []} me={me?.user ?? null} />
      ) : (
        <ReadOnly />
      )}
    </KeyboardAvoidingView>
  );
}

const Message = memo(function Message({
  item,
  mine,
  formatLocale,
  timeZone,
  onDelete,
}: {
  item: ChatItem;
  mine: boolean;
  formatLocale: string;
  timeZone: string;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("jobs.chat");
  const { message } = item;
  const hasText = message.segments.length > 0;

  return (
    <View className={item.opensRun ? "pt-stack-loose" : "pt-1"}>
      {item.day ? (
        <Text className="pb-stack pt-stack text-center text-label uppercase text-muted-foreground">
          {formatDayHeading(item.day, formatLocale)}
        </Text>
      ) : null}
      <View className={`flex-row gap-2 ${mine ? "justify-end" : ""}`}>
        {mine ? null : item.opensRun && message.author ? <Avatar person={message.author} size={28} /> : <View className="w-7" />}
        <View className={`max-w-[80%] gap-1 ${mine ? "items-end" : "items-start"}`}>
          {item.opensRun ? (
            <Text className="text-caption text-muted-foreground">
              {mine ? "" : `${personName(message.author, t("someone"))} · `}
              {formatTime(message.createdAt, formatLocale, timeZone)}
            </Text>
          ) : null}
          <Pressable
            disabled={!message.canDelete}
            onLongPress={() => onDelete(message.id)}
            accessibilityHint={message.canDelete ? t("deleteMessage") : undefined}
            className={`gap-2 ${message.pending ? "opacity-60" : ""}`}
          >
            {hasText ? (
              <View className={`rounded-2xl px-3.5 py-2 ${mine ? "bg-primary" : "border border-border bg-card"}`}>
                <Segments segments={message.segments} mine={mine} />
              </View>
            ) : null}
            <FileGrid files={message.files} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

/** A mention reads as one, and a link opens in the in-app browser. */
function Segments({ segments, mine }: { segments: ChatSegment[]; mine: boolean }) {
  const ink = mine ? "text-primary-foreground" : "text-card-foreground";
  const accent = mine ? "text-primary-foreground" : "text-brand-ink";
  return (
    <Text selectable className={`text-body ${ink}`}>
      {segments.map((segment, index) =>
        segment.type === "text" ? (
          segment.text
        ) : segment.type === "mention" ? (
          <Text key={index} className={`font-semibold ${accent}`}>
            {segment.text}
          </Text>
        ) : (
          <Text key={index} accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(segment.href)} className={`underline ${accent}`}>
            {segment.text}
          </Text>
        ),
      )}
    </Text>
  );
}

function ReadOnly() {
  const t = useTranslations("jobs.chat");
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingBottom: Math.max(insets.bottom, 12) }} className="border-t border-border bg-card px-gutter pt-3">
      <Text className="text-center text-footnote text-muted-foreground">{t("readOnly")}</Text>
    </View>
  );
}

/** The box, the photos going up with it, and the `@` list above it while a name is being typed. */
function Composer({ jobId, people, me }: { jobId: string; people: Person[]; me: Person | null }) {
  const t = useTranslations();
  const errorText = useErrorText();
  const insets = useSafeAreaInsets();
  const placeholder = useColor("muted-foreground");
  const sendInk = useColor("primary-foreground");
  const files = useAttachments(jobId);
  const send = useSendChat(jobId, me);
  const [body, setBody] = useState("");
  const [caret, setCaret] = useState(0);

  const mention = mentionCandidates(body.slice(0, caret), people, me?.id);
  const ready = (body.trim() !== "" || files.ready.length > 0) && !files.busy && !files.failed && !send.isPending;

  const submit = () => {
    const text = body.trim();
    const uploads = files.ready;
    setBody("");
    send.mutate(
      { body: text, uploads },
      // The words leave the box at once; refused, they come back, and the photos stay until it goes.
      { onSuccess: () => files.drop(uploads), onError: () => setBody((current) => current || text) },
    );
  };

  return (
    <View style={{ paddingBottom: Math.max(insets.bottom, 8) }} className="gap-2 border-t border-border bg-card px-3 pt-2">
      {mention && mention.people.length ? (
        <View accessibilityLabel={t("jobs.chat.mentionList")} className="overflow-hidden rounded-xl border border-border bg-popover">
          {mention.people.map((person) => (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              onPress={() => setBody(insertMention(body, mention.start, caret, person))}
              className="min-h-12 flex-row items-center gap-3 px-3 active:bg-muted"
            >
              <Avatar person={person} size={28} />
              <Text className="text-callout text-popover-foreground">{personName(person)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <ErrorText>{send.error ? errorText(send.error) : null}</ErrorText>
      <AttachmentStrip items={files.items} onRemove={files.remove} onRetry={(key) => void files.retry(key)} />
      <View className="flex-row items-end gap-1">
        <AttachButton onPicked={(assets) => void files.add(assets)} />
        <TextInput
          value={body}
          onChangeText={setBody}
          onSelectionChange={(event) => setCaret(event.nativeEvent.selection.end)}
          placeholder={t("jobs.chat.message")}
          placeholderTextColor={placeholder}
          accessibilityLabel={t("jobs.chat.message")}
          maxLength={MAX_CHAT_LENGTH}
          multiline
          className="max-h-32 min-h-12 flex-1 rounded-2xl border border-input bg-field px-4 py-3 text-body text-foreground"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("jobs.chat.send")}
          accessibilityState={{ disabled: !ready }}
          disabled={!ready}
          onPress={submit}
          className={`size-12 items-center justify-center rounded-full bg-primary ${ready ? "" : "opacity-40"}`}
        >
          {files.busy ? <ActivityIndicator color={sendInk} /> : <ArrowUp size={22} color={sendInk} />}
        </Pressable>
      </View>
    </View>
  );
}
