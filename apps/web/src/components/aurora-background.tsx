/**
 * A slow, ambient backdrop — a macOS-style dynamic wallpaper rather than a
 * page that reads as blank. Three blurred blobs (see `.aurora-blob` in
 * `globals.css`) drift and rescale on long, staggered loops so the motion
 * reads as atmosphere, not animation.
 *
 * `colors` defaults to a fixed blue/violet/teal trio for pages with no
 * company to take a colour from (the marketing page, the root sign-in). A
 * company's own login screen passes `auroraPalette(primaryColor, accentColor)`
 * instead, so the wallpaper is built from colours it actually configured.
 * They arrive as plain `oklch()` strings rather than Tailwind classes because
 * the palette is only known at request time — the same reason `BrandTheme`
 * injects its own `<style>` instead of a class.
 *
 * Sized in `vw`/`vh` rather than a fixed `rem`: a blob's offset below is a
 * fraction of the *viewport*, so a fixed-size blob at a fraction offset
 * landed mostly outside it on anything wider than a phone — just the
 * blurred edge showing as a faint arc in the corner. Scaling the blob itself
 * with the viewport keeps the same fraction meaningful at any size.
 *
 * Pure CSS: a server component with no client JS to hydrate, and
 * `prefers-reduced-motion` freezes the drift without removing the colour.
 */
const DEFAULT_PALETTE: readonly [string, string, string] = [
  "oklch(0.65 0.2 262)",
  "oklch(0.6 0.22 300)",
  "oklch(0.75 0.14 195)",
];

export function AuroraBackground({
  colors = DEFAULT_PALETTE,
}: {
  colors?: readonly [string, string, string];
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="aurora-blob aurora-blob-1 -top-[10vh] -left-[10vw] h-[46vw] w-[46vw]"
        style={{ background: colors[0] }}
      />
      <div
        className="aurora-blob aurora-blob-2 -top-[5vh] -right-[12vw] h-[42vw] w-[42vw]"
        style={{ background: colors[1] }}
      />
      <div
        className="aurora-blob aurora-blob-3 -bottom-[15vh] left-[20vw] h-[44vw] w-[44vw]"
        style={{ background: colors[2] }}
      />
    </div>
  );
}
