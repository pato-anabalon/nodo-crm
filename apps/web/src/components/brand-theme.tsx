import { hexToOklch, inkOn } from "@/lib/theme/color";

/**
 * Applies the company's colour over the theme tokens.
 *
 * Injected as a <style> in the subdomain layout: the branding lands on the first
 * render, with no flash and no client-side JavaScript.
 */
/** The card surfaces from `globals.css`, which is what this text sits on. */
const LIGHT_CARD = "#ffffff";
const DARK_CARD = "#1d283a";

export function BrandTheme({
  primaryColor,
  accentColor,
}: {
  primaryColor: string;
  accentColor: string;
}) {
  const primary = hexToOklch(primaryColor);
  const accent = hexToOklch(accentColor);
  if (!primary) return null;

  /*
   * `--brand-ink` is the colour as *text*, which is not the same colour.
   *
   * The brand is picked to sit under white on a button; the same value as an
   * 11px label on a card can land under 4.5:1 — PlasterPro's orange does on
   * white, the default blue does on the dark card. `inkOn` keeps the hue and
   * moves only the lightness until it clears the bar, against each ground
   * separately: a dark theme is not the light one inverted.
   */
  const css = [
    ":root{",
    `--primary:${primary.css};`,
    `--primary-foreground:${primary.readableForeground};`,
    `--ring:${primary.css};`,
    `--sidebar-primary:${primary.css};`,
    `--sidebar-primary-foreground:${primary.readableForeground};`,
    `--brand-ink:${inkOn(primary, LIGHT_CARD)};`,
    accent ? `--chart-1:${accent.css};` : "",
    "}",
    // After the stylesheet, so it wins over the `.dark` block there.
    `.dark{--brand-ink:${inkOn(primary, DARK_CARD)};}`,
  ].join("");

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
