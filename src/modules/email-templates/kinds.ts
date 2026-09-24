import { EmailTemplateKind } from "@/generated/prisma/enums";

/**
 * What the platform does when a company has said nothing.
 *
 * No row is the ordinary state, not an unconfigured one, so these defaults are
 * what most companies will actually send. They live here rather than being
 * written into the row at sign-up for two reasons: a company created last year
 * still gets today's wording, and adding a sixth email doesn't need a backfill.
 */
export type KindDefaults = {
  /** Whether it goes out when nothing has been configured. */
  enabled: boolean;
  /** Whether the screen offers a switch at all. */
  optional: boolean;
};

export const TEMPLATE_KINDS: Record<EmailTemplateKind, KindDefaults> = {
  // Sending a quote *is* emailing the customer, so there is nothing to turn off.
  [EmailTemplateKind.NEW_QUOTE]: { enabled: true, optional: false },

  // A confirmation to somebody who just acted. It can only reach a person who
  // pressed accept a second earlier, so it is on from the start.
  [EmailTemplateKind.QUOTE_ACCEPTED]: { enabled: true, optional: true },

  /**
   * The three below are **off** until a company turns them on.
   *
   * They are the only ones a scheduler sends, and the first sweep after they
   * ship would look at every quote already sitting out there undecided. On by
   * default, that is a night where every customer with an old quote is chased at
   * once, by nobody's decision. The cost of being off is that they do nothing
   * until somebody asks for them, which is the right way round.
   */
  [EmailTemplateKind.FIRST_FOLLOW_UP]: { enabled: false, optional: true },
  [EmailTemplateKind.SECOND_FOLLOW_UP]: { enabled: false, optional: true },
  [EmailTemplateKind.REVIEW_REQUEST]: { enabled: false, optional: true },
};

/** The order the settings screen lists them in: the life of a quote. */
export const TEMPLATE_ORDER: EmailTemplateKind[] = [
  EmailTemplateKind.NEW_QUOTE,
  EmailTemplateKind.FIRST_FOLLOW_UP,
  EmailTemplateKind.SECOND_FOLLOW_UP,
  EmailTemplateKind.QUOTE_ACCEPTED,
  EmailTemplateKind.REVIEW_REQUEST,
];

/** What Phase A actually sends. The rest are configurable but dormant. */
export const IMPLEMENTED_KINDS: EmailTemplateKind[] = [
  EmailTemplateKind.NEW_QUOTE,
  EmailTemplateKind.QUOTE_ACCEPTED,
];

export function isOptional(kind: EmailTemplateKind): boolean {
  return TEMPLATE_KINDS[kind].optional;
}

/**
 * Whether this email goes out, given what the company saved.
 *
 * `null` means no row: the company has chosen nothing and the platform's
 * default decides. A row always wins, including a row that turns something off.
 */
export function isEnabled(
  kind: EmailTemplateKind,
  stored: { enabled: boolean } | null,
): boolean {
  if (!isOptional(kind)) return true;
  return stored ? stored.enabled : TEMPLATE_KINDS[kind].enabled;
}
