import { brandVars } from "@nodo/tokens/brand";

/**
 * Applies the company's colour over the theme tokens.
 *
 * Injected as a <style> in the subdomain layout: the branding lands on the first
 * render, with no flash and no client-side JavaScript. The values are
 * `brandVars`, which the app hands to its own root as well — including
 * `--brand-ink`, the colour as text, worked out against each scheme's card.
 */
export function BrandTheme({
  primaryColor,
  accentColor,
}: {
  primaryColor: string;
  accentColor: string;
}) {
  const vars = brandVars(primaryColor, accentColor);
  if (!vars) return null;

  const declare = (values: Record<string, string>) =>
    Object.entries(values).map(([name, value]) => `--${name}:${value};`).join("");
  // Dark only says what differs: the fill is the company's in both schemes.
  const dark = Object.fromEntries(
    Object.entries(vars.dark).filter(([name, value]) => vars.light[name as keyof typeof vars.light] !== value),
  );

  // After the stylesheet, so `:root` wins over the `.dark` block there too.
  const css = `:root{${declare(vars.light)}}.dark{${declare(dark)}}`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
