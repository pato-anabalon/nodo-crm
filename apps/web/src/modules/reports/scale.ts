/**
 * Round gridline values for a chart's value axis.
 *
 * The trend chart used to draw its three gridlines at 0%, 50% and 100% of
 * whatever the period's own maximum happened to be — a figure nobody chose,
 * so the axis read $0, $367,260.50, $734,521. This is what a person would
 * pick by hand instead: steps of 1, 2 or 5 times a power of ten, the same
 * "nice numbers" rule most charting libraries use (D3's `ticks` among them).
 */

/** The nicest round step at or above `roughStep`: 1, 2, 5 or 10 × a power of ten. */
function niceStep(roughStep: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;

  if (residual <= 1) return magnitude;
  if (residual <= 2) return 2 * magnitude;
  if (residual <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

/**
 * Gridline values from 0 up to (at least) `max`, roughly `targetCount` of
 * them. Always includes 0 and always reaches past `max`, so the top of the
 * data never sits exactly on the last line or above it.
 */
export function niceTicks(max: number, targetCount = 5): number[] {
  if (!(max > 0)) return [0];

  const step = niceStep(max / targetCount);
  const count = Math.ceil(max / step);
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}
