/**
 * Origin control for public keys.
 *
 * A public key travels in the HTML of an open site, so anyone can copy it. What
 * stops it being used from elsewhere is this list: the browser sends `Origin` on
 * every cross-site request and it can't be forged from JavaScript.
 */

/** Normalises to `https://site.co.nz`, with no path or trailing slash. */
export function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "" || trimmed === "null") return null;

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * A pattern can be an exact origin (`https://acme.co.nz`) or a one-level
 * wildcard (`https://*.acme.co.nz`), which is what's needed when a site has both
 * staging and production.
 */
export function originMatches(pattern: string, origin: string): boolean {
  const normalizedPattern = normalizeOrigin(pattern);
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedPattern || !normalizedOrigin) return false;

  if (normalizedPattern === normalizedOrigin) return true;

  const wildcard = normalizedPattern.match(/^(https?:\/\/)\*\.(.+)$/);
  if (!wildcard) return false;

  const [, protocol, base] = wildcard;
  if (!normalizedOrigin.startsWith(protocol)) return false;

  const host = normalizedOrigin.slice(protocol.length);
  // One level only: `app.acme.co.nz` yes, `a.b.acme.co.nz` no.
  if (!host.endsWith(`.${base}`)) return false;

  const sub = host.slice(0, -(base.length + 1));
  return sub.length > 0 && !sub.includes(".");
}

export function isOriginAllowed(allowed: string[], origin: string | null): boolean {
  // With no `Origin` it's a server-to-server request that never touched a
  // browser: the list doesn't apply there, the key type decides.
  if (!origin) return false;
  return allowed.some((pattern) => originMatches(pattern, origin));
}

/** CORS headers telling the browser it may post. */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key, Idempotency-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
