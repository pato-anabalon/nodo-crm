import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { ReviewsManager } from "@/modules/settings/reviews-manager";
import { ReviewPlatformsManager } from "@/modules/settings/review-platforms-manager";
import {
  removeReviewPlatformAction,
  saveReviewPlatformAction,
} from "@/modules/settings/actions";
import { SettingsHeader } from "@/modules/settings/settings-header";

export async function generateMetadata() {
  const t = await getTranslations("settings.reviews");
  return { title: t("title") };
}

export default async function ResenasPage() {
  const ctx = await requirePermission("settings.read");
  const t = await getTranslations("settings.reviews");

  const [reviews, platforms] = await Promise.all([
    ctx.db.companyReview.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    }),
    ctx.db.reviewLink.findMany({
      orderBy: { position: "asc" },
      select: { id: true, source: true, label: true, readUrl: true, leaveUrl: true },
    }),
  ]);

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

      {/* Everything about reviews in one screen: the ones quoted on the
          document above, and where the customer goes to read more or to leave
          their own below — the latter is what the review request email sends,
          which is why its links moved here from the emails screen. */}
      <ReviewPlatformsManager
        platforms={platforms}
        canManage={ctx.permissions.has("settings.update")}
        save={saveReviewPlatformAction}
        remove={removeReviewPlatformAction}
      />
    </div>
  );
}
