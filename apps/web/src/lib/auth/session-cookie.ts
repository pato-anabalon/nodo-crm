/**
 * The session cookie's name.
 *
 * It is set on `.<ROOT_DOMAIN>` so one sign-in covers every company's
 * subdomain — which means production's cookie, on `.crm.nodo.co.nz`, also
 * reaches the test instance at `*.test.crm.nodo.co.nz`. Under one name the
 * browser sends both and Auth.js reads whichever comes first: a test request
 * carrying production's user id, a user test has never heard of, and "You
 * don't have access" that signing out of test can't clear, since only test's
 * own cookie goes.
 *
 * `AUTH_COOKIE_SUFFIX` is set on every instance except production, so
 * production's name — and everybody's signed-in session there — stays as it
 * was. Anything outside letters, digits, `-` and `_` is dropped rather than
 * trusted: a stray `;` or `=` would break the `Set-Cookie` header outright.
 */
export function sessionCookieName(secure: boolean, suffix: string | undefined): string {
  const base = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
  const clean = (suffix ?? "").replace(/[^A-Za-z0-9_-]/g, "");
  return clean ? `${base}.${clean}` : base;
}
