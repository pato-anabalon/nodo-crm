/**
 * Quote status colours.
 *
 * Validated for colour blindness (ΔE deutan 16.3, normal vision 20.0) in both
 * light and dark. They're status colours, not series colours: never reused for
 * anything else and never changed by the company's brand colour.
 *
 * Blue for "accepted" isn't arbitrary: it's what Quotient uses and what the
 * validator accepts, because green can't separate from red under deuteranopia.
 */
export const QUOTE_STATUS_COLORS = {
  accepted: "var(--quote-accepted)",
  awaiting: "var(--quote-awaiting)",
  declined: "var(--quote-declined)",
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
};

export const QUOTE_STATUS_ORDER: QuoteStatusKey[] = ["accepted", "awaiting", "declined"];
