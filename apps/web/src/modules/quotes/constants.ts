import { QuoteStatus } from "@/generated/prisma/enums";

/** The visible names live in the message files, under `quotes.status.*`. */
export const QUOTE_STATUSES: readonly QuoteStatus[] = [
  QuoteStatus.DRAFT,
  QuoteStatus.SENT,
  QuoteStatus.ACCEPTED,
  QuoteStatus.REJECTED,
  QuoteStatus.EXPIRED,
];

/**
 * A quote can be edited while it's still being worked on, and while it's out
 * with the customer awaiting an answer. What makes the second one safe is that
 * the email never carried prices or lines — the share link is the only source
 * and it's read live, so a correction reaches the customer's own open link
 * rather than leaving a stale copy in their inbox alongside a fresh one.
 *
 * Once the customer has answered, the quote is history: `ACCEPTED` is frozen
 * for good, and a `REJECTED` or `EXPIRED` one is revived by sending again
 * (which reopens editing), not by editing what's already closed.
 */
export function isQuoteEditable(status: QuoteStatus): boolean {
  return status === QuoteStatus.DRAFT || status === QuoteStatus.SENT;
}

/**
 * Narrower than `isQuoteEditable`: the lead decides who the quote is for, and
 * once it has gone out somebody already holds the link. Re-pointing a sent
 * quote would show the new customer's details to whoever opened the old one,
 * so the lead is fixed from the first send. A different customer gets a
 * different quote — duplicating does exactly that.
 */
export function canChangeLead(status: QuoteStatus): boolean {
  return status === QuoteStatus.DRAFT;
}

/**
 * The badge colour for each status.
 *
 * Written out one by one rather than built from the status name: Tailwind reads
 * the source for class names, and a composed string would never be generated.
 */
export const QUOTE_STATUS_CLASS: Record<QuoteStatus, string> = {
  [QuoteStatus.DRAFT]: "border-transparent bg-[var(--status-draft)] text-[var(--status-draft-fg)]",
  [QuoteStatus.SENT]: "border-transparent bg-[var(--status-sent)] text-[var(--status-sent-fg)]",
  [QuoteStatus.ACCEPTED]: "border-transparent bg-[var(--status-accepted)] text-[var(--status-accepted-fg)]",
  [QuoteStatus.REJECTED]: "border-transparent bg-[var(--status-declined)] text-[var(--status-declined-fg)]",
  [QuoteStatus.EXPIRED]: "border-transparent bg-[var(--status-expired)] text-[var(--status-expired-fg)]",
};

/**
 * The same statuses written as text rather than filled behind it.
 *
 * For lists, where a row of pills at eight rows is noise. The colour still has
 * the word beside it — it *is* the word — so the condition that lets these
 * afford green and red still holds.
 */
export const QUOTE_STATUS_TEXT_CLASS: Record<QuoteStatus, string> = {
  [QuoteStatus.DRAFT]: "text-[var(--status-draft-text)]",
  [QuoteStatus.SENT]: "text-[var(--status-sent-text)]",
  [QuoteStatus.ACCEPTED]: "text-[var(--status-accepted-text)]",
  [QuoteStatus.REJECTED]: "text-[var(--status-declined-text)]",
  [QuoteStatus.EXPIRED]: "text-[var(--status-expired-text)]",
};

/**
 * A soft badge: the status's own colour as text, on a faint wash of itself.
 *
 * Built on the `--status-*-text` set, which was chosen to read against the
 * ground it sits on, so the word stays legible on the wash in both themes. The
 * company's colours never reach it — a status means the same in every company.
 */
export const QUOTE_STATUS_SOFT_CLASS: Record<QuoteStatus, string> = {
  // Written out whole, never assembled: Tailwind only generates a class it can
  // read in the source, and a template string leaves the badge with no fill.
  [QuoteStatus.DRAFT]: "border-transparent bg-[color-mix(in_oklab,var(--status-draft-text)_14%,transparent)] text-[var(--status-draft-text)]",
  [QuoteStatus.SENT]: "border-transparent bg-[color-mix(in_oklab,var(--status-sent-text)_14%,transparent)] text-[var(--status-sent-text)]",
  [QuoteStatus.ACCEPTED]: "border-transparent bg-[color-mix(in_oklab,var(--status-accepted-text)_14%,transparent)] text-[var(--status-accepted-text)]",
  [QuoteStatus.REJECTED]: "border-transparent bg-[color-mix(in_oklab,var(--status-declined-text)_14%,transparent)] text-[var(--status-declined-text)]",
  [QuoteStatus.EXPIRED]: "border-transparent bg-[color-mix(in_oklab,var(--status-expired-text)_14%,transparent)] text-[var(--status-expired-text)]",
};

/** Valid status transitions. Stops, for instance, going back from Accepted to Draft. */
export const QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  DRAFT: [QuoteStatus.SENT],
  SENT: [QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [QuoteStatus.SENT],
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return QUOTE_TRANSITIONS[from].includes(to);
}

/**
 * Default expiry date, from the number of days the company configures.
 * It lives here rather than in the component because reading the clock during
 * render makes React treat the component as impure.
 */
export function defaultValidUntil(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Panel sections.
 *
 * Not new statuses: views over the ones that already exist, grouped the way
 * Quotient groups them. That's why the database enum doesn't change.
 */
export const QUOTE_SECTIONS = ["all", "draft", "waiting", "active", "closed"] as const;

export type QuoteSection = (typeof QUOTE_SECTIONS)[number];

export function sectionStatuses(section: QuoteSection): QuoteStatus[] | null {
  switch (section) {
    case "draft":
      return [QuoteStatus.DRAFT];
    // Sent and still awaiting the customer's answer.
    case "waiting":
      return [QuoteStatus.SENT];
    // Everything still commercially alive.
    case "active":
      return [QuoteStatus.SENT, QuoteStatus.ACCEPTED];
    case "closed":
      return [QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED];
    default:
      return null;
  }
}

export function isQuoteSection(value: string | undefined | null): value is QuoteSection {
  return QUOTE_SECTIONS.includes(value as QuoteSection);
}

/**
 * The id of the quote's edit `<form>`. A control that lives elsewhere on the page
 * (the owner select in the header) joins the form through the `form` attribute,
 * so it posts with Save changes without sitting inside it.
 */
export const QUOTE_FORM_ID = "quote-form";
