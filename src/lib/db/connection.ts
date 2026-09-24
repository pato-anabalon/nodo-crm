/**
 * The SSL modes `pg` is about to reinterpret.
 *
 * Today the driver treats all three as `verify-full` — the certificate chain and
 * the host name are both checked. From pg v9 they take on libpq's meaning, where
 * the connection is encrypted but the certificate is not verified, so a man in
 * the middle presenting any certificate would be accepted.
 */
const WEAKENING_MODES = new Set(["prefer", "require", "verify-ca"]);

/**
 * Pins the connection to the strict SSL mode it already uses.
 *
 * Neon hands out `?sslmode=require`, which is why the driver prints its warning.
 * Writing `verify-full` explicitly keeps exactly today's behaviour and stops the
 * upgrade from silently loosening it. The alternative — editing the variable in
 * Vercel — doesn't survive the Neon integration rewriting it, and would have to
 * be repeated for every environment.
 *
 * Two things are deliberately left alone: `sslmode=disable`, because a local
 * Postgres without TLS is a legitimate setup, and any URL that already opted
 * into libpq semantics, because that is someone choosing on purpose.
 */
export function withStrictSsl(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    // Not a URL we can reason about; hand it over untouched and let pg complain.
    return connectionString;
  }

  if (url.searchParams.get("uselibpqcompat") === "true") return connectionString;

  const mode = url.searchParams.get("sslmode");
  if (mode !== null && !WEAKENING_MODES.has(mode)) return connectionString;

  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}
