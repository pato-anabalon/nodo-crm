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
 * A quote can only be edited while it hasn't gone out to the customer. After
 * that, what was sent must stay as it is: if something changes, issue another.
 */
export function isQuoteEditable(status: QuoteStatus): boolean {
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
