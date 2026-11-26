/**
 * What changed in a sent quote, as the customer would see it: the line the
 * quote's history keeps for every save that changed something, and what tells
 * a save that changed nothing from one that did. Pure, so the comparison is
 * checked without a database.
 *
 * Stored as tokens, never as sentences — like a notification, it is worded
 * when read, in the reader's language and the company's format. Long texts
 * (introduction, notes, exclusions, terms, a section's description) say only
 * that they were edited: what the customer agreed to is frozen at acceptance,
 * and two near-identical paragraphs in a log are something nobody compares.
 * What only the team sees — the owner, the lead — isn't a change at all.
 */

export type QuoteSnapshot = {
  title: string;
  /** `YYYY-MM-DD`, or null. */
  validUntil: string | null;
  currency: string;
  taxDisplayMode: string;
  taxRate: number;
  pricingMode: string;
  quoteType: string | null;
  projectAddress: string | null;
  termsDocumentId: string | null;
  discount: Discount;
  /** The bundle discount on optional sections, as one comparable value. */
  optionalDiscount: string | null;
  total: number;
  texts: Record<TextField, string>;
  items: SnapshotItem[];
  /** A kept section carries its id; a new one has none. */
  sections: SnapshotSection[];
};

export type Discount = { type: string; value: number };
export type SnapshotItem = { description: string; quantity: number; unitPrice: number; discount: number };
export type SnapshotSection = {
  id: string | null;
  title: string;
  body: string;
  amount: number;
  kind: string;
  selectedByDefault: boolean;
  discountType: string;
  discountValue: number;
};

export const TEXT_FIELDS = ["intro", "scope", "notes", "exclusions", "terms"] as const;
export type TextField = (typeof TEXT_FIELDS)[number];

/** Short values, kept as they were and as they became. */
export type ValueField = "title" | "validUntil" | "currency" | "taxDisplayMode" | "taxRate" | "pricingMode" | "quoteType" | "projectAddress";

/** Said to have changed, without their content. */
export type EditedField = TextField | "termsDocument" | "optionalDiscount";

type Line = { quantity: number; unitPrice: number; discount: number };

export type QuoteChange =
  | { kind: "value"; field: ValueField; from: string | null; to: string | null }
  | { kind: "edited"; field: EditedField }
  | { kind: "discount"; from: Discount; to: Discount }
  | { kind: "total"; from: number; to: number }
  | { kind: "item"; change: "added" | "removed"; description: string; quantity: number; unitPrice: number }
  | { kind: "item"; change: "changed"; description: string; from: Line; to: Line }
  | { kind: "section"; change: "added" | "removed"; title: string; amount: number }
  | { kind: "section"; change: "renamed"; from: string; to: string }
  | { kind: "section"; change: "amount"; title: string; from: number; to: number }
  | { kind: "section"; change: "body" | "options"; title: string };

const VALUE_FIELDS: ValueField[] = ["title", "validUntil", "currency", "taxDisplayMode", "taxRate", "pricingMode", "quoteType", "projectAddress"];

const cents = (amount: number) => Math.round(amount * 100);
const sameMoney = (a: number, b: number) => cents(a) === cents(b);
const sameNumber = (a: number, b: number) => Math.abs(a - b) < 1e-9;

export function quoteChanges(before: QuoteSnapshot, after: QuoteSnapshot): QuoteChange[] {
  const changes: QuoteChange[] = [];

  for (const field of VALUE_FIELDS) {
    const from = field === "taxRate" ? String(before.taxRate) : before[field];
    const to = field === "taxRate" ? String(after.taxRate) : after[field];
    const same = field === "taxRate" ? sameNumber(before.taxRate, after.taxRate) : (from ?? "") === (to ?? "");
    if (!same) changes.push({ kind: "value", field, from: from ?? null, to: to ?? null });
  }

  if (before.discount.type !== after.discount.type || !sameNumber(before.discount.value, after.discount.value)) {
    // A discount of nothing reads the same whichever way it would be counted.
    if (before.discount.value !== 0 || after.discount.value !== 0) changes.push({ kind: "discount", from: before.discount, to: after.discount });
  }
  if ((before.optionalDiscount ?? "") !== (after.optionalDiscount ?? "")) changes.push({ kind: "edited", field: "optionalDiscount" });
  if ((before.termsDocumentId ?? "") !== (after.termsDocumentId ?? "")) changes.push({ kind: "edited", field: "termsDocument" });
  for (const field of TEXT_FIELDS) {
    if (before.texts[field] !== after.texts[field]) changes.push({ kind: "edited", field });
  }

  changes.push(...itemChanges(before.items, after.items));
  changes.push(...sectionChanges(before.sections, after.sections));

  if (!sameMoney(before.total, after.total)) changes.push({ kind: "total", from: before.total, to: after.total });
  return changes;
}

/**
 * Lines have no identity of their own — they are replaced on every save — so
 * they are matched by what they say: the same description before and after is
 * the same line, and a repeated one pairs off in order.
 */
function itemChanges(before: readonly SnapshotItem[], after: readonly SnapshotItem[]): QuoteChange[] {
  const key = (item: SnapshotItem) => item.description.trim().toLowerCase();
  const left = [...before];
  const changes: QuoteChange[] = [];

  for (const item of after) {
    const index = left.findIndex((old) => key(old) === key(item));
    if (index === -1) {
      changes.push({ kind: "item", change: "added", description: item.description, quantity: item.quantity, unitPrice: item.unitPrice });
      continue;
    }
    const [old] = left.splice(index, 1);
    if (!sameNumber(old.quantity, item.quantity) || !sameMoney(old.unitPrice, item.unitPrice) || !sameNumber(old.discount, item.discount)) {
      changes.push({
        kind: "item",
        change: "changed",
        description: item.description,
        from: { quantity: old.quantity, unitPrice: old.unitPrice, discount: old.discount },
        to: { quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount },
      });
    }
  }
  for (const old of left) {
    changes.push({ kind: "item", change: "removed", description: old.description, quantity: old.quantity, unitPrice: old.unitPrice });
  }
  return changes;
}

/** Sections keep their row across a save, so they are matched by id. */
function sectionChanges(before: readonly SnapshotSection[], after: readonly SnapshotSection[]): QuoteChange[] {
  const kept = new Map(before.filter((section) => section.id).map((section) => [section.id!, section]));
  const seen = new Set<string>();
  const changes: QuoteChange[] = [];

  for (const section of after) {
    const old = section.id ? kept.get(section.id) : undefined;
    if (!old) {
      changes.push({ kind: "section", change: "added", title: section.title, amount: section.amount });
      continue;
    }
    seen.add(old.id!);
    if (old.title !== section.title) changes.push({ kind: "section", change: "renamed", from: old.title, to: section.title });
    if (!sameMoney(old.amount, section.amount)) {
      changes.push({ kind: "section", change: "amount", title: section.title, from: old.amount, to: section.amount });
    }
    if (old.body !== section.body) changes.push({ kind: "section", change: "body", title: section.title });
    const options =
      old.kind !== section.kind ||
      old.selectedByDefault !== section.selectedByDefault ||
      old.discountType !== section.discountType ||
      !sameNumber(old.discountValue, section.discountValue);
    if (options) changes.push({ kind: "section", change: "options", title: section.title });
  }
  for (const old of before) {
    if (!old.id || !seen.has(old.id)) changes.push({ kind: "section", change: "removed", title: old.title, amount: old.amount });
  }
  return changes;
}
