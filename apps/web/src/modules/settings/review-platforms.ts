import type { ReviewSource } from "@/generated/prisma/enums";

/**
 * The platforms a company is reviewed on, as everything downstream reads them.
 *
 * One row per platform (`ReviewLink`) holds two addresses, and the three
 * places that use them each want one: the quote and the PDF list where to
 * *read* more reviews, the review-request email hands over where to *leave*
 * one. Kept pure, so which link goes where — and what a platform is called in
 * front of a customer — is checked without a database.
 */
export type ReviewPlatform = {
  source: ReviewSource;
  label: string | null;
  readUrl: string | null;
  leaveUrl: string | null;
};

/** Proper nouns, so they are not translated. */
const KNOWN: Partial<Record<ReviewSource, string>> = {
  GOOGLE: "Google",
  NOCOWBOYS: "NoCowboys",
  FACEBOOK: "Facebook",
};

/**
 * What the customer reads after "more reviews on".
 *
 * A known platform by its own name; "somewhere else" by the name the company
 * gave it. An `OTHER` row saved before names existed has none, and its address
 * is the honest stand-in — `builderscrack.co.nz` says where the link goes, "Web"
 * says nothing.
 */
export function platformName(platform: Pick<ReviewPlatform, "source" | "label">, url: string): string {
  if (platform.label) return platform.label;
  const known = KNOWN[platform.source];
  if (known) return known;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Web";
  }
}

export type PlatformLink = { name: string; url: string };

/** Listed under the reviews on the quote and in the PDF. */
export function readLinks(platforms: ReviewPlatform[]): PlatformLink[] {
  return platforms.flatMap((platform) =>
    platform.readUrl ? [{ name: platformName(platform, platform.readUrl), url: platform.readUrl }] : [],
  );
}

/** Handed over by the review-request email; none means it doesn't go out. */
export function leaveLinks(platforms: ReviewPlatform[]): PlatformLink[] {
  return platforms.flatMap((platform) =>
    platform.leaveUrl
      ? [{ name: platformName(platform, platform.leaveUrl), url: platform.leaveUrl }]
      : [],
  );
}
