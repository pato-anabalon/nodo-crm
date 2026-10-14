import { getTranslations } from "next-intl/server";
import { can, requirePermission } from "@/lib/auth/session";
import { SettingsHeader } from "@/modules/settings/settings-header";
import { postCategoryName } from "@/modules/jobs/categories";
import { postCategoriesWithUse } from "@/modules/jobs/board/service";
import { createPostCategoryAction, deletePostCategoryAction } from "@/modules/jobs/board/actions";
import { PostCategoriesManager } from "@/modules/jobs/board/categories-manager";

export async function generateMetadata() {
  const t = await getTranslations("postCategories");
  return { title: t("title") };
}

export default async function PostCategoriesPage() {
  const ctx = await requirePermission("settings.read");
  const [t, tBoard] = await Promise.all([getTranslations("postCategories"), getTranslations("jobs.board")]);
  const categories = await postCategoriesWithUse(ctx);

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("title")} subtitle={t("subtitle")} />
      <PostCategoriesManager
        categories={categories.map((category) => ({
          id: category.id,
          emoji: category.emoji,
          name: postCategoryName(category, tBoard),
          posts: category._count.posts,
        }))}
        canManage={can(ctx, "settings.update")}
        onAdd={createPostCategoryAction}
        onDelete={deletePostCategoryAction}
      />
    </div>
  );
}
