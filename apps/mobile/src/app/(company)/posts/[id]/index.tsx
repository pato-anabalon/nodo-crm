import { useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { Avatar, personName } from "@/components/avatars";
import { CommentComposer, Comments } from "@/components/comments";
import { FileGrid } from "@/components/files";
import { RichText } from "@/components/rich-text";
import { Failed, Loading } from "@/components/screen";
import { useCategoryName } from "@/lib/board";
import { useColor } from "@/lib/brand";
import { useErrorText } from "@/lib/errors";
import { useElapsed } from "@/lib/format";
import { canOn, useAddPostComment, useJob, useMe, usePost } from "@/lib/queries";

/** One post, read as the web draws it — the board's full rich text — with its files and its conversation. */
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const errorText = useErrorText();
  const post = usePost(id);
  const jobId = post.data?.post.jobId ?? "";
  const job = useJob(jobId);
  const addComment = useAddPostComment(id, jobId);
  const { data: me } = useMe();
  const ago = useElapsed(me?.company.formatLocale ?? "en-NZ", me?.company.timezone ?? "UTC");
  const categoryName = useCategoryName();
  const spinner = useColor("muted-foreground");

  if (post.isPending) return <Loading />;
  if (!post.data) return <Failed text={errorText(post.error)} retry={() => post.refetch()} retryLabel={t("mobile.retry")} />;

  const detail = post.data.post;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100} className="flex-1">
      <ScrollView
        contentContainerClassName="gap-section px-gutter pb-section pt-stack"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={post.isRefetching} onRefresh={() => void post.refetch()} tintColor={spinner} />}
      >
        <View className="gap-stack-loose">
          {detail.category ? (
            <Text className="text-label uppercase text-muted-foreground">
              {detail.category.emoji} {categoryName(detail.category)}
            </Text>
          ) : null}
          <Text accessibilityRole="header" className="text-title-2 text-foreground">
            {detail.title}
          </Text>
          <View className="flex-row items-center gap-2">
            {detail.author ? <Avatar person={detail.author} size={28} /> : null}
            <Text className="flex-1 text-footnote text-muted-foreground">
              <Text className="font-semibold text-foreground">{personName(detail.author, t("jobs.board.someone"))}</Text> ·{" "}
              {ago(detail.publishedAt)}
              {detail.editedAt ? ` · ${t("jobs.board.edited")}` : ""}
            </Text>
          </View>
        </View>

        {detail.body ? <RichText html={detail.body} /> : null}
        <FileGrid files={detail.files} />
        <Comments comments={detail.comments} />
      </ScrollView>
      {canOn(job.data, "comments.create") ? <CommentComposer jobId={detail.jobId} send={addComment} /> : null}
    </KeyboardAvoidingView>
  );
}
