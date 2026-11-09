import { Link, useLocalSearchParams } from "expo-router";
import { MessageCircle, Paperclip } from "lucide-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { Avatar, personName } from "@/components/avatars";
import { Failed, Loading } from "@/components/screen";
import { useCategoryName } from "@/lib/board";
import { useColor } from "@/lib/brand";
import { useErrorText } from "@/lib/errors";
import { useElapsed } from "@/lib/format";
import { useBoard, useMe } from "@/lib/queries";
import type { PostCategory, PostSummary } from "@/lib/types";

/**
 * The Message Board: published posts, newest first, a line of each, with the
 * categories to narrow them. Read here and answered with comments; posts are
 * written on the web, where the editor is.
 */
export default function BoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations();
  const errorText = useErrorText();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const board = useBoard(id, categoryId);
  const spinner = useColor("muted-foreground");

  if (board.isPending) return <Loading />;
  if (!board.data) return <Failed text={errorText(board.error)} retry={() => board.refetch()} retryLabel={t("mobile.retry")} />;

  const { categories, posts } = board.data;

  return (
    <ScrollView
      contentContainerClassName="gap-stack-loose pb-section pt-stack"
      refreshControl={<RefreshControl refreshing={board.isRefetching} onRefresh={() => void board.refetch()} tintColor={spinner} />}
    >
      {categories.length ? <Categories categories={categories} selected={categoryId} onSelect={setCategoryId} /> : null}
      <View className={`gap-stack px-gutter ${board.isPlaceholderData ? "opacity-50" : ""}`}>
        {posts.length === 0 ? (
          <Text className="py-section text-center text-callout text-muted-foreground">
            {t(categoryId ? "jobs.board.emptyCategory" : "jobs.board.empty")}
          </Text>
        ) : (
          posts.map((post) => <PostRow key={post.id} post={post} />)
        )}
      </View>
    </ScrollView>
  );
}

function Categories({ categories, selected, onSelect }: { categories: PostCategory[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const t = useTranslations("jobs.board");
  const name = useCategoryName();
  const chips = [{ id: null, label: t("allCategories") }, ...categories.map((category) => ({ id: category.id, label: `${category.emoji} ${name(category)}` }))];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={t("filterLabel")} contentContainerClassName="gap-2 px-gutter">
      {chips.map((chip) => {
        const on = chip.id === selected;
        return (
          <Pressable
            key={chip.id ?? "all"}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(chip.id)}
            className={`min-h-11 justify-center rounded-full border px-4 ${on ? "border-primary bg-primary" : "border-border bg-card active:bg-muted"}`}
          >
            <Text className={`text-callout font-medium ${on ? "text-primary-foreground" : "text-card-foreground"}`}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PostRow({ post }: { post: PostSummary }) {
  const t = useTranslations("jobs.board");
  const { data: me } = useMe();
  const ago = useElapsed(me?.company.formatLocale ?? "en-NZ", me?.company.timezone ?? "UTC");
  const name = useCategoryName();
  const muted = useColor("muted-foreground");

  return (
    <Link href={{ pathname: "/posts/[id]", params: { id: post.id } }} asChild>
      <Pressable accessibilityRole="button" className="gap-2 rounded-xl border border-border bg-card p-card-pad active:bg-muted">
        {post.category ? (
          <Text className="text-label uppercase text-muted-foreground">
            {post.category.emoji} {name(post.category)}
          </Text>
        ) : null}
        <Text className="text-headline text-card-foreground">{post.title}</Text>
        {post.excerpt ? (
          <Text className="text-callout text-muted-foreground" numberOfLines={2}>
            {post.excerpt}
          </Text>
        ) : null}
        <View className="flex-row items-center gap-2 pt-1">
          {post.author ? <Avatar person={post.author} size={22} /> : null}
          <Text className="flex-1 text-footnote text-muted-foreground" numberOfLines={1}>
            {personName(post.author, t("someone"))} · {ago(post.publishedAt)}
          </Text>
          {post.fileCount ? <Paperclip size={14} color={muted} accessibilityLabel={String(post.fileCount)} /> : null}
          {post.commentCount ? (
            <View className="flex-row items-center gap-1" accessibilityLabel={t("commentCount", { count: post.commentCount })}>
              <MessageCircle size={14} color={muted} />
              <Text className="text-footnote text-muted-foreground">{post.commentCount}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}
