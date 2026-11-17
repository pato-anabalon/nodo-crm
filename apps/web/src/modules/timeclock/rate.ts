/** The highest hourly rate taken: a typo of an extra zero or three is caught, a real rate isn't. */
export const MAX_HOURLY_RATE = 10_000;

/**
 * An hourly rate as typed: `32.5`, `32.50`, `$32.50`, `32,50`. Empty is no
 * rate (null); anything that isn't a sum of money to the cent is undefined.
 */
export function parseHourlyRate(text: string): number | null | undefined {
  const cleaned = text.trim().replace(/^\$/, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const rate = Number(cleaned);
  return rate <= MAX_HOURLY_RATE ? rate : undefined;
}
