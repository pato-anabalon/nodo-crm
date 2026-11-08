/**
 * Quote status colours.
 *
 * Validated for colour blindness (ΔE deutan 16.3, normal vision 20.0 for the
 * original three) in both light and dark. They're status colours, not series
 * colours: never reused for anything else and never changed by the company's
 * brand colour.
 *
 * "expired" reuses the badge's own `--status-expired` grey — see the comment
 * on `--quote-expired` in `globals.css` for why it's fixed at the light
 * value in both themes rather than switching to the dark badge's inverted
 * one, and the simulated ΔE that choice is based on.
 */
export const QUOTE_STATUS_COLORS = {
  accepted: "var(--quote-accepted)",
  awaiting: "var(--quote-awaiting)",
  declined: "var(--quote-declined)",
  expired: "var(--quote-expired)",
} as const;

export type QuoteStatusKey = keyof typeof QUOTE_STATUS_COLORS;

/**
 * A diagonal texture per status, as a second encoding.
 *
 * Colour never travels alone: in single-ink print, in forced-colours mode or
 * with severe colour blindness, the texture is what tells the segments apart.
 */
export const QUOTE_STATUS_PATTERN: Record<QuoteStatusKey, number> = {
  accepted: 45,
  awaiting: 135,
  declined: 0,
  expired: 90,
};

export const QUOTE_STATUS_ORDER: QuoteStatusKey[] = ["accepted", "declined", "expired", "awaiting"];
