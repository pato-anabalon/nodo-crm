/**
 * The addresses a company adds to the "new lead" notice by hand.
 *
 * Kept as a plain list of strings the company owns, not as users: they are for a
 * shared inbox, an office manager with no account, or an owner who reads mail on
 * a personal address. Anyone who *does* have an account chooses for themselves
 * in `NotificationPreference`, and is never in this list.
 */

/** Enough for a small team's shared inboxes; past this it's a mailing list. */
export const MAX_EXTRA_RECIPIENTS = 20;

export type AddOutcome =
  | { ok: true; list: string[] }
  | { ok: false; reason: "invalid" | "duplicate" | "full" };

/** Same shape the rest of the system stores addresses in, so they compare. */
export function normaliseAddress(email: string): string {
  return email.trim().toLowerCase();
}

function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Adds one address, or says why it can't.
 *
 * One at a time and validated on the way in, rather than a comma-separated box
 * parsed on save: a typo in the third address of a string is invisible until the
 * notice quietly stops arriving.
 */
export function addExtraRecipient(list: string[], email: string): AddOutcome {
  const clean = normaliseAddress(email);

  if (!looksLikeEmail(clean)) return { ok: false, reason: "invalid" };
  if (list.some((existing) => normaliseAddress(existing) === clean)) {
    return { ok: false, reason: "duplicate" };
  }
  if (list.length >= MAX_EXTRA_RECIPIENTS) return { ok: false, reason: "full" };

  return { ok: true, list: [...list, clean] };
}

/** Removes one address. Comparing normalised, so what is shown is what goes. */
export function removeExtraRecipient(list: string[], email: string): string[] {
  const clean = normaliseAddress(email);
  return list.filter((existing) => normaliseAddress(existing) !== clean);
}

/**
 * The extra addresses that aren't already being written to.
 *
 * Someone who is both on the team and on this list would otherwise get the same
 * lead twice, which is how people start ignoring the notice.
 */
export function withoutStaff(extras: string[], staffEmails: string[]): string[] {
  const staff = new Set(staffEmails.map(normaliseAddress));
  return extras.filter((email) => !staff.has(normaliseAddress(email)));
}
