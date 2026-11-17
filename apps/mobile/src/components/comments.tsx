import type { UseMutationResult } from "@tanstack/react-query";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { AttachButton, AttachmentStrip } from "@/components/attachments";
import { Avatar, personName } from "@/components/avatars";
import { Button } from "@/components/button";
import { FileGrid } from "@/components/files";
import { RichText } from "@/components/rich-text";
import { ErrorText } from "@/components/screen";
import { useColor } from "@/lib/brand";
import { useErrorText } from "@/lib/errors";
import { useElapsed } from "@/lib/format";
import { useMe } from "@/lib/queries";
import type { Comment } from "@/lib/types";
import { useAttachments, type UploadedFile } from "@/lib/uploads";

/**
 * A conversation under something — a to-do, a post — drawn one way wherever
 * it is, as the web's `CommentThread` is: the stored HTML read-only, its
 * files, and a box to answer in plain text with photos.
 */
export function Comments({ comments }: { comments: Comment[] }) {
  const t = useTranslations("jobs.board");
  const { data: me } = useMe();
  const ago = useElapsed(me?.company.formatLocale ?? "en-NZ", me?.company.timezone ?? "UTC");

  return (
    <View className="gap-stack-loose">
      <Text accessibilityRole="header" className="text-title-3 text-foreground">
        {t("comments", { count: comments.length })}
      </Text>
      {comments.map((comment) => (
        <View key={comment.id} className="flex-row gap-3">
          {comment.author ? <Avatar person={comment.author} size={32} /> : <View className="size-8" />}
          <View className="flex-1 gap-1.5">
            <Text className="text-footnote text-muted-foreground">
              <Text className="font-semibold text-foreground">{personName(comment.author, "—")}</Text> · {ago(comment.createdAt)}
            </Text>
            <RichText html={comment.body} />
            <FileGrid files={comment.files} />
          </View>
        </View>
      ))}
    </View>
  );
}

type Send = UseMutationResult<{ id: string }, Error, { body: string; uploads: UploadedFile[] }, unknown>;

/** Pinned under the conversation, above the keyboard: what the thumb reaches. Photos go up as they're picked. */
export function CommentComposer({ jobId, send: add }: { jobId: string; send: Send }) {
  const t = useTranslations("jobs.board");
  const errorText = useErrorText();
  const files = useAttachments(jobId);
  const insets = useSafeAreaInsets();
  const placeholder = useColor("muted-foreground");
  const [body, setBody] = useState("");
  const ready = (body.trim() !== "" || files.ready.length > 0) && !files.busy && !files.failed;

  const send = () => {
    const uploads = files.ready;
    add.mutate(
      { body: body.trim(), uploads },
      {
        onSuccess: () => {
          setBody("");
          files.drop(uploads);
        },
      },
    );
  };

  return (
    <View style={{ paddingBottom: Math.max(insets.bottom, 12) }} className="gap-2 border-t border-border bg-card px-gutter pt-3">
      <ErrorText>{add.error ? errorText(add.error) : null}</ErrorText>
      <AttachmentStrip items={files.items} onRemove={files.remove} onRetry={(key) => void files.retry(key)} />
      <View className="flex-row items-end gap-2">
        <AttachButton onPicked={(assets) => void files.add(assets)} />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={t("commentPlaceholder")}
          placeholderTextColor={placeholder}
          accessibilityLabel={t("comment")}
          multiline
          className="max-h-32 min-h-12 flex-1 rounded-xl border border-input bg-field px-4 py-3 text-body text-foreground"
        />
        <Button label={t("comment")} busy={add.isPending} disabled={!ready} onPress={send} />
      </View>
    </View>
  );
}
