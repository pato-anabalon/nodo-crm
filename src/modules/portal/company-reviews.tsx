import { getTranslations } from "next-intl/server";
import { Star } from "lucide-react";
import type { ReviewSource } from "@/generated/prisma/enums";
import type { Locale } from "@/i18n/config";

export type PortalReview = {
  id: string;
  author: string;
  rating: number;
  body: string;
  source: ReviewSource;
  sourceUrl: string | null;
};

/**
 * The company's reviews, added by the company itself with a link to the original.
 *
 * They aren't pulled from Google live: their terms forbid storing them, so they'd
 * have to be fetched — and paid for — on every quote open, which is exactly what
 * the tracking panel counts.
 */
export async function CompanyReviews({
  reviews,
  locale,
}: {
  reviews: PortalReview[];
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: "portal" });
  if (reviews.length === 0) return null;

  return (
    <section className="space-y-4 border-t pt-8">
      <h2 className="text-lg font-semibold">{t("reviews")}</h2>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <li key={review.id} className="space-y-2 text-sm">
            <Stars rating={review.rating} />
            <p className="text-muted-foreground">{review.body}</p>
            <p className="italic">
              {review.sourceUrl ? (
                <a
                  href={review.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="underline underline-offset-2"
                >
                  {t("reviewBy", { author: review.author })}
                </a>
              ) : (
                t("reviewBy", { author: review.author })
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <p className="flex gap-0.5" aria-label={`${filled}/5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden
          className={index < filled ? "size-4 fill-current" : "size-4 text-muted-foreground/30"}
        />
      ))}
    </p>
  );
}
