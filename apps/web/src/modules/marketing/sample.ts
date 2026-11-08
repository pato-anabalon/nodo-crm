/**
 * The screenshots the public page shows inside its phones. They are
 * placeholders until real captures replace them: same file name, same
 * 1179 × 2556 portrait (an iPhone screen at 3×), and nothing else changes.
 *
 * Where to take each one from, in the app:
 * - `leads`         `/leads`
 * - `quote-builder` `/quotes/<id>/edit`
 * - `portal`        the customer's quote, scrolled to its sections
 * - `accept`        the acceptance panel with a signature
 */
export const SCREENS = {
  leads: "/landing/screens/leads.png",
  quoteBuilder: "/landing/screens/quote-builder.png",
  portal: "/landing/screens/portal.png",
  accept: "/landing/screens/accept.png",
} as const;

export const SCREEN_SIZE = { width: 1179, height: 2556 } as const;
