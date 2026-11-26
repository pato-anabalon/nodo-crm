import type { QuoteChange } from "./changes";

/**
 * A change worded for somebody on the team — on the quote's history and in
 * the notice that it changed. The customer is never shown this: their email
 * only says the quote was updated. Money in the quote's currency and the
 * company's format, words in the reader's language, both handed in, so this
 * stays pure and reads the same on the page and in the email.
 */

/** Keys under `quotes`. */
export type Words = (key: string, values?: Record<string, string | number>) => string;

export type ChangeFormat = {
  money: (amount: number) => string;
  /** `YYYY-MM-DD` as the company writes a date. */
  date: (day: string) => string;
};

export function describeChange(change: QuoteChange, t: Words, format: ChangeFormat): string {
  const none = t("changes.none");
  const line = (quantity: number, unitPrice: number) => `${quantity} × ${format.money(unitPrice)}`;

  switch (change.kind) {
    case "value": {
      const word = (value: string | null): string => {
        if (value === null || value === "") return none;
        if (change.field === "validUntil") return format.date(value);
        if (change.field === "taxDisplayMode") return t(`taxDisplayMode.${value}`);
        if (change.field === "pricingMode") return t(`form.pricingMode.${value}`);
        if (change.field === "taxRate") return `${value}%`;
        return value;
      };
      return t(`changes.value.${change.field}`, { from: word(change.from), to: word(change.to) });
    }
    case "edited":
      return t(`changes.edited.${change.field}`);
    case "discount": {
      const word = (discount: { type: string; value: number }) =>
        discount.value === 0 ? none : discount.type === "PERCENT" ? `${discount.value}%` : format.money(discount.value);
      return t("changes.discount", { from: word(change.from), to: word(change.to) });
    }
    case "total":
      return t("changes.total", { from: format.money(change.from), to: format.money(change.to) });
    case "item":
      if (change.change === "changed") {
        return t("changes.item.changed", {
          description: change.description,
          from: line(change.from.quantity, change.from.unitPrice),
          to: line(change.to.quantity, change.to.unitPrice),
        });
      }
      return t(`changes.item.${change.change}`, { description: change.description, line: line(change.quantity, change.unitPrice) });
    case "section":
      switch (change.change) {
        case "added":
        case "removed":
          return t(`changes.section.${change.change}`, { title: change.title, amount: format.money(change.amount) });
        case "renamed":
          return t("changes.section.renamed", { from: change.from, to: change.to });
        case "amount":
          return t("changes.section.amount", { title: change.title, from: format.money(change.from), to: format.money(change.to) });
        default:
          return t(`changes.section.${change.change}`, { title: change.title });
      }
  }
}

/** What was stored, read back defensively: a row written by another version of the code is shown as far as it can be. */
export function storedChanges(value: unknown): QuoteChange[] {
  return Array.isArray(value) ? (value.filter((change) => change && typeof change === "object" && "kind" in change) as QuoteChange[]) : [];
}
