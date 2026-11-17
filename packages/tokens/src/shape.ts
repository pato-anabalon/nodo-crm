/**
 * Radii, spacing, touch targets, icon sizes and layers — the numbers that were
 * decided screen by screen and now aren't. All in px (dp on the phone).
 */

/**
 * Concentric: something inside something else takes the parent's radius minus
 * the padding between them (`nestedRadius`), so the two curves run parallel.
 * The web's cards and fields sit at `lg`/`md`; the app's, a size up at `xl`.
 */
export const RADII = { xs: 4, sm: 6, md: 8, lg: 10, xl: 14, "2xl": 20, full: 9999 } as const;
export type RadiusName = keyof typeof RADII;

/**
 * The steps the web already derives from its `--radius` (10). `xs` and `2xl`
 * are left out of the generated CSS on purpose: Tailwind's own are 2 and 16,
 * already in use, and changing them is the web's codemod to make, looked at
 * screen by screen — not a side effect of moving the tokens.
 */
export const WEB_RADII = ["sm", "md", "lg", "xl"] as const satisfies readonly RadiusName[];

export function nestedRadius(parent: number, padding: number): number {
  return Math.max(RADII.xs, parent - padding);
}

/** A 4 grid, and only these steps of it. */
export const SPACE = [2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;

/** The spacing that used to be chosen per screen, by what it is for. */
export const LAYOUT = {
  /** The phone's side margin. The web's grows with the screen (24–40). */
  gutter: 16,
  cardPad: { app: 16, web: 24 },
  stack: 8,
  stackLoose: 16,
  section: 32,
} as const;

/**
 * Gloves and dirty hands on site: the app's ordinary target is 48, not the
 * 44 minimum, and clocking in or out is 64. The web is 36 with a pointer and
 * 44 under `(pointer: coarse)`.
 */
export const TARGETS = { min: 44, comfortable: 48, primary: 64, hitSlop: 8, webPointer: 36 } as const;

/** Inline with text, inside a button, in the app's navigation. */
export const ICONS = { inline: 16, button: 20, nav: 24 } as const;

/** The toast sits over everything, sheets included. */
export const LAYERS = { sticky: 10, dropdown: 20, sheet: 30, toast: 40 } as const;

/**
 * The app's four haptics, and nothing more: feedback that fires for
 * everything is feedback nobody notices. Each fires on the same frame as the
 * change on screen.
 */
export const HAPTICS = {
  /** A punch the server confirmed. */
  success: "success",
  /** Outside the site's radius. */
  warning: "warning",
  /** Stepping through a picker. */
  selection: "selection",
  /** Ticking a to-do off. */
  impact: "impact-light",
} as const;
