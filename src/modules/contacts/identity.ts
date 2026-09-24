/**
 * How a person is recognised and named.
 *
 * Kept apart from the queries because the awkward cases — one-word names, an
 * address typed with different capitalisation, a lead with no email at all —
 * are settled once here and tested without a database.
 */

/**
 * The address a contact is matched on.
 *
 * Lower-cased and trimmed, because the same person writes their address with
 * different capitalisation from one form to the next and that must not produce
 * two contacts. Empty becomes `null`: an absent address is not a value people
 * share, so it must never match anybody.
 */
export function normaliseEmail(email: string | null | undefined): string | null {
  const trimmed = (email ?? "").trim().toLowerCase();
  return trimmed === "" ? null : trimmed;
}

export type PersonName = { firstName: string; lastName: string | null };

/**
 * Splits the single name a web form collects into the two the record keeps.
 *
 * The last word is taken as the surname and everything before it as the given
 * name, which is right for "Steve Scott" and for "Ana María Reyes" alike. A
 * single word is a given name with no surname rather than a surname on its own:
 * people introduce themselves by their first name.
 */
export function splitPersonName(full: string): PersonName {
  const words = full.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return { firstName: "", lastName: null };
  if (words.length === 1) return { firstName: words[0], lastName: null };

  return { firstName: words.slice(0, -1).join(" "), lastName: words.at(-1)! };
}

/** The name shown wherever a contact is listed or referred to. */
export function contactDisplayName(contact: {
  firstName: string;
  lastName?: string | null;
}): string {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
}

/**
 * Whether a lead's details are worth turning into a contact.
 *
 * An address is what makes a person findable again, and without one every new
 * enquiry would create another unconnected record. A lead with only a phone
 * number keeps its details inline until somebody links it by hand.
 */
export function canBecomeContact(lead: {
  contactName?: string | null;
  contactEmail?: string | null;
}): boolean {
  return normaliseEmail(lead.contactEmail) !== null && (lead.contactName ?? "").trim() !== "";
}
