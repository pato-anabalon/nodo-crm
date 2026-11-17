import { useTranslations } from "use-intl";
import type { PostCategory } from "./types";

/** A standard category is translated from its key, as on the web; the company's own reads as it was named. */
export function useCategoryName() {
  const t = useTranslations("jobs.board");
  return (category: PostCategory) => category.name ?? t(`categories.${category.key}` as "categories.FYI");
}
