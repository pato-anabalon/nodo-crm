/**
 * The address a customer of the platform is invited to write to, and the one
 * replies to our emails go to.
 *
 * **Deliberately not one of `PLATFORM_ADMIN_EMAILS`.** Those are the accounts
 * that get into /admin, and an address put in front of every company's owner is
 * an address everybody knows — which is a hint about where the way in is. This
 * is a mailbox that only receives, with its own variable so the two can never be
 * the same by accident.
 *
 * Null when unset or not an address: callers then leave the reply-to off and
 * point at the public site instead, rather than send a half-made invitation.
 */
export function platformContactEmail(): string | null {
  const value = (process.env.PLATFORM_CONTACT_EMAIL ?? "").trim();
  return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(value) ? value : null;
}
