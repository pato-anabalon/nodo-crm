import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Star } from "lucide-react";
import type { ReviewSource } from "@/generated/prisma/enums";
import type { Locale } from "@/i18n/config";
import type { PlatformLink } from "@/modules/settings/review-platforms";

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
 *
 * Under them, where to read the rest: the three quoted here are the company's
 * pick, and the links are how a customer checks that the pick is fair. They
 * show even with no review quoted — somewhere to read reviews is worth
 * offering on its own.
 */
export async function CompanyReviews({
  reviews,
  links,
  locale,
}: {
  reviews: PortalReview[];
  links: PlatformLink[];
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: "portal" });
  if (reviews.length === 0 && links.length === 0) return null;

  return (
    <section className="space-y-4 border-t pt-8">
      <h2 className="text-lg font-semibold">{t("reviews")}</h2>

      {reviews.length > 0 ? (
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
      ) : null}

      {links.length > 0 ? (
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {links.map((link) => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 font-medium text-[var(--brand-ink)] underline underline-offset-2"
              >
                {t("readMoreReviews", { platform: link.name })}
                <ArrowUpRight aria-hidden className="size-3.5" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
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
