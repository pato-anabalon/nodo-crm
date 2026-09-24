import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { ReviewsManager } from "@/modules/settings/reviews-manager";
import { SettingsHeader } from "@/modules/settings/settings-header";

export async function generateMetadata() {
  const t = await getTranslations("settings.reviews");
  return { title: t("title") };
}

export default async function ResenasPage() {
  const ctx = await requirePermission("settings.read");
  const t = await getTranslations("settings.reviews");

  const reviews = await ctx.db.companyReview.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("title")} subtitle={t("subtitle")} />

      <ReviewsManager
        reviews={reviews.map((review) => ({
          id: review.id,
          author: review.author,
          rating: review.rating,
          body: review.body,
          source: review.source,
          sourceUrl: review.sourceUrl,
          featured: review.featured,
        }))}
        canManage={ctx.permissions.has("settings.update")}
      />
    </div>
  );
}
