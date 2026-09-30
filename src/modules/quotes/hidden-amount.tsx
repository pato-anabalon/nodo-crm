import { getTranslations } from "next-intl/server";

/**
 * Stands in for a figure the viewer's profile isn't allowed to see.
 *
 * `quotes.read.amounts` hides a **datum**, not a row or an action: the quote
 * itself, its status, its customer, still show. A blank cell in their place
 * would read as missing data rather than a deliberate choice, so this says
 * so instead — quiet, but not silent. Rendered from a server component, which
 * is what makes this a real boundary rather than a cosmetic one: the figure
 * itself never reaches the browser, there is nothing client-side to hide.
 */
export async function HiddenAmount() {
  const t = await getTranslations("quotes");
  return <span className="text-muted-foreground italic">{t("amountHidden")}</span>;
}
