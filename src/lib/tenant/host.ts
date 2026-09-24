/**
 * Resolving the company from the host.
 *
 * Each company lives on its own subdomain (`acme.nodo-crm.app`). The root domain
 * and `www` are the public site (marketing, sign-up, central sign-in), and
 * locally `acme.localhost:3000` works.
 *
 * A pure function with no dependencies, so it can be tested without booting the app.
 */

export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

/** Subdomains that are never a company. */
const RESERVED_SLUGS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "auth",
  "mail",
  "static",
  "assets",
  "cdn",
  "vercel",
]);

export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  // The `host` header can arrive with a port and in mixed case.
  return host.trim().toLowerCase().split(",")[0]?.trim() ?? null;
}

/**
 * Returns the company slug, or null when the host points at the public site.
 */
export function companySlugFromHost(
  host: string | null | undefined,
  rootDomain: string = ROOT_DOMAIN,
): string | null {
  const normalized = normalizeHost(host);
  if (!normalized) return null;

  const hostname = stripPort(normalized);
  const root = stripPort(rootDomain.toLowerCase());

  // Vercel preview URLs carry no company subdomain.
  if (hostname.endsWith(".vercel.app")) return null;

  if (hostname === root) return null;
  if (!hostname.endsWith(`.${root}`)) return null;

  const slug = hostname.slice(0, -(root.length + 1));

  // Only one level is accepted: `acme.root`, not `a.b.root`.
  if (!slug || slug.includes(".")) return null;
  if (RESERVED_SLUGS.has(slug)) return null;
  if (!isValidSlug(slug)) return null;

  return slug;
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/.test(slug) && !slug.includes("--");
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

function stripPort(value: string): string {
  return value.split(":")[0];
}

/** Absolute URL of a company's subdomain. */
export function companyUrl(slug: string, path = "/", rootDomain: string = ROOT_DOMAIN): string {
  const protocol = rootDomain.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${slug}.${rootDomain}${path}`;
}
