/**
 * One type scale by role. Each role fixes size, leading, tracking and weight
 * together, because hierarchy is built from the set and not from size alone.
 * Tracking moves with size: negative as text grows, slightly positive as it
 * shrinks, so no single `letter-spacing` is wrong somewhere.
 *
 * Sizes are px at the default text size. The web writes them in rem, so the
 * reader's browser setting scales them; the app hands them to React Native,
 * which scales them with Dynamic Type / font scale.
 *
 * The web's dense default body is `callout` (14); the app's is `body` (16).
 * A role without a `weight` inherits it, so `font-medium` on top still works.
 */

export type TypeRole = {
  size: number;
  leading: number;
  /** In em, so it means the same at any size. */
  tracking: number;
  weight?: 400 | 500 | 600 | 700;
  uppercase?: true;
  tabular?: true;
};

export const TYPE_SCALE = {
  /* Uppercase labels: table headers, FROM/PHONE on the quote. 11 is the floor —
     the smallest size iOS ships (caption2), and what `--brand-ink`'s contrast
     was worked out for. */
  label: { size: 11, leading: 14, tracking: 0.06, weight: 600, uppercase: true },
  caption: { size: 12, leading: 16, tracking: 0.01 },
  footnote: { size: 13, leading: 18, tracking: 0 },
  callout: { size: 14, leading: 20, tracking: 0 },
  body: { size: 16, leading: 24, tracking: -0.005 },
  headline: { size: 17, leading: 22, tracking: -0.01, weight: 600 },
  "title-3": { size: 20, leading: 25, tracking: -0.012, weight: 600 },
  "title-2": { size: 24, leading: 30, tracking: -0.016, weight: 700 },
  "title-1": { size: 28, leading: 34, tracking: -0.02, weight: 700 },
  display: { size: 34, leading: 40, tracking: -0.022, weight: 700 },
  /* The clock's running time, and the figures on a dashboard. */
  "numeric-xl": { size: 48, leading: 52, tracking: -0.03, weight: 700, tabular: true },
} satisfies Record<string, TypeRole>;

export type TypeRoleName = keyof typeof TYPE_SCALE;

/**
 * Dense screens cap how far the reader's text size may grow them; a lineup of
 * bars at 300% is unusable rather than accessible. Everywhere else is uncapped.
 */
export const MAX_FONT_SCALE_DENSE = 1.6;

/**
 * Print and email can't read either of the above — a PDF is laid out in
 * points, and an email client ignores classes — so each has its own fixed
 * steps, named after the role they stand in for. Nothing outside these lists
 * should be typed as a bare number in `portal/pdf/` or an email template.
 */
export const PDF_TYPE_PT = {
  label: 8,
  caption: 9,
  callout: 10,
  body: 11,
  "title-3": 12,
  "title-2": 20,
  display: 24,
} as const;

export const EMAIL_TYPE_PX = {
  caption: 12,
  footnote: 13,
  callout: 14,
  body: 15,
  "title-3": 18,
  "title-2": 20,
} as const;
