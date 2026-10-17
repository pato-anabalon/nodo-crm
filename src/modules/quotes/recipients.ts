import { normaliseEmail } from "@/modules/contacts/identity";

/**
 * Who a quote goes to, kept pure so the rules can be checked without a
 * database.
 *
 * A quote has one primary recipient — the "For" on the document — and any
 * number of copies. Every one of them gets their own email and their own link,
 * which is what lets the portal know which of them is reading.
 */

export type RecipientDraft = { name: string; email: string; contactId: string | null };

/**
 * The primary recipient a quote starts with, taken from its lead.
 *
 * No address means no recipient: there is nobody to send it to, and a row
 * without one would be a name the send loop has to skip. A lead with an
 * address and no name is named by the address, because the portal has to
 * call whoever opens the link something.
 */
export function primaryRecipientFrom(
  lead: { contactName: string | null; contactEmail: string | null; contactId?: string | null } | null,
): RecipientDraft | null {
  const email = normaliseEmail(lead?.contactEmail);
  if (!lead || !email) return null;
  return { name: lead.contactName?.trim() || email, email, contactId: lead.contactId ?? null };
}

/**
 * Everybody a quote is written to, as one phrase: "Ana, Bruno and Carla".
 *
 * Each recipient gets an email addressed to them alone, but the greeting names
 * all of them — the same thing Quotient does, and what tells each person who
 * else has the quote in front of them. Joined by the quote's own language, so
 * a Spanish quote reads "Ana, Bruno y Carla".
 */
export function joinNames(names: string[], locale: string): string {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(clean);
}

/** The ordering every list of recipients uses: the primary first, then as added. */
export function sortRecipients<T extends { isPrimary: boolean; position: number }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position,
  );
}

export type RecipientRemoval = "ok" | "not-found" | "primary";

/**
 * Whether a recipient can be taken off a quote.
 *
 * The primary can't: a quote with copies and no "For" has nobody for the
 * document to be addressed to. Another one is made primary first.
 */
export function canRemoveRecipient(
  recipients: Array<{ id: string; isPrimary: boolean }>,
  recipientId: string,
): RecipientRemoval {
  const target = recipients.find((recipient) => recipient.id === recipientId);
  if (!target) return "not-found";
  if (target.isPrimary) return "primary";
  return "ok";
}

/** A name for somebody added by address alone, the way a contact names them. */
export function recipientName(firstName: string, lastName: string | null | undefined): string {
  return [firstName.trim(), lastName?.trim()].filter(Boolean).join(" ");
}
