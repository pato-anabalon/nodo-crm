import { sanitizeRichText } from "@/lib/rich-text";
import {
  resolveSelectedSectionAmounts,
  type SectionKind,
  type SelectableSection,
} from "@/modules/quotes/section-selection";

/**
 * What a job keeps of the quote it came from: **what was sold, never what it
 * cost**. A line's description, a section's title and its write-up — the frame
 * of the work. The figures stay on the quote, behind `quotes.read.amounts`; a
 * job is read by people who have nothing to do with the price.
 */
export type ScopeItemValues = { position: number; title: string; body: string | null };

type QuoteItemRow = { position: number; description: string };

type QuoteSectionRow = {
  id: string;
  position: number;
  title: string;
  body: string | null;
  kind: SectionKind;
  selectedByDefault: boolean;
  customerSelected: boolean | null;
  // Needed to ask "does this one count?" the same way the quote does; never copied.
  amount: number;
  discountType: SelectableSection["discountType"];
  discountValue: number;
};

export type ScopeSource = {
  pricingMode: "ITEMIZED" | "SECTIONS";
  items: QuoteItemRow[];
  sections: QuoteSectionRow[];
};

/**
 * One entry per line of an itemised quote; one per section the customer
 * actually bought of a sectioned one. Which sections those are is not decided
 * here: `resolveSelectedSectionAmounts` is the one place that knows (an
 * optional left unticked and the multiple-choice loser are out), and asking it
 * keeps this from becoming a second opinion on what the customer agreed to.
 */
export function scopeItemsFromQuote(quote: ScopeSource): ScopeItemValues[] {
  if (quote.pricingMode === "ITEMIZED") {
    return [...quote.items]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ title: item.description.trim(), body: null }))
      .filter((item) => item.title !== "")
      .map((item, index) => ({ position: index, ...item }));
  }

  const ordered = [...quote.sections].sort((a, b) => a.position - b.position);
  const selection = Object.fromEntries(ordered.map((section) => [section.id, section.customerSelected]));
  const counted = new Set(resolveSelectedSectionAmounts(ordered, selection).included.map((entry) => entry.id));

  return ordered
    .filter((section) => counted.has(section.id))
    .map((section, index) => {
      const body = section.body ? sanitizeRichText(section.body, "basic") : "";
      return { position: index, title: section.title.trim(), body: body === "" ? null : body };
    });
}
