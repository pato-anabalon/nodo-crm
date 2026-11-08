/**
 * Rate limit for magic-link requests, kept away from the query — same
 * reason `modules/ingest/limits.ts` does.
 *
 * Sized for a person who mistyped their email or didn't get the first one:
 * a few requests an hour, not the dozens a script hammering the form would
 * send.
 */

/** The rate-limit window. */
export const RATE_WINDOW_MINUTES = 60;

/** Magic-link requests per hour from one IP, across every company. */
export const RATE_LIMIT_PER_IP = 5;

export function windowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - RATE_WINDOW_MINUTES * 60 * 1000);
}

/** Decides whether the limit was exceeded. Pure, so the edge sits in a test, not in a query. */
export function loginRateLimited(countInWindow: number): boolean {
  return countInWindow >= RATE_LIMIT_PER_IP;
}

/**
 * The client IP behind Vercel's proxy — the same reading
 * `modules/ingest/limits.ts#clientIp` does, duplicated rather than shared
 * because importing across a `lib`/`modules` boundary for four lines isn't
 * worth the coupling.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || null;
}
