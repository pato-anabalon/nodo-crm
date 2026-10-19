/**
 * The Message Board's standard kinds of post — Basecamp's five, which the
 * people moving over already know by their emoji.
 *
 * Stored by `key` with no name and translated on the way out, the same as a
 * standard profile, so the board reads in each person's language. The
 * migration that created the table seeded these for every company already
 * there; `createCompanyWithOwner` seeds them for each new one. Keep the two in
 * step — a test holds this list against the migration.
 */
export const STANDARD_POST_CATEGORIES = [
  { key: "ANNOUNCEMENT", emoji: "📢" },
  { key: "FYI", emoji: "✨" },
  { key: "HEARTBEAT", emoji: "❤️" },
  { key: "PITCH", emoji: "💡" },
  { key: "QUESTION", emoji: "❓" },
] as const;

export type StandardPostCategoryKey = (typeof STANDARD_POST_CATEGORIES)[number]["key"];

export function isStandardPostCategory(key: string | null): key is StandardPostCategoryKey {
  return STANDARD_POST_CATEGORIES.some((category) => category.key === key);
}

/** A category's name in the reader's words: the company's own, or the standard one translated. */
export function postCategoryName(
  category: { key: string | null; name: string | null },
  t: (key: string) => string,
): string {
  if (category.name) return category.name;
  return isStandardPostCategory(category.key) ? t(`categories.${category.key}`) : (category.key ?? "");
}
