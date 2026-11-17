import { isIP } from "node:net";

/**
 * Limits for the ingest API.
 *
 * Sized for contact forms, not bulk integrations: a person doesn't send five
 * enquiries in an hour, and a small business site doesn't take more than a
 * hundred leads an hour even on its best day.
 */

/** Maximum body size. A contact form doesn't go beyond a few KB. */
export const MAX_BODY_BYTES = 64 * 1024;

/** The rate-limit window. */
export const RATE_WINDOW_MINUTES = 60;

/** Submissions per hour for a single key. */
export const RATE_LIMIT_PER_KEY = 120;

/**
 * Submissions per hour from one IP **towards one company**.
 *
 * The scope matters: counting the IP globally would block different people
 * behind the same office NAT or mobile CGNAT against each other, which in New
 * Zealand is the norm. Scoped per company, the limit still catches a form sent
 * in a loop without punishing bystanders.
 */
export const RATE_LIMIT_PER_IP = 5;

export function windowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - RATE_WINDOW_MINUTES * 60 * 1000);
}

export type RateVerdict = { limited: false } | { limited: true; scope: "key" | "ip" };

/** Decides whether the limit was exceeded. Pure, so the edges can be tested. */
export function checkRate(counts: { byKey: number; byIp: number }): RateVerdict {
  if (counts.byKey >= RATE_LIMIT_PER_KEY) return { limited: true, scope: "key" };
  if (counts.byIp >= RATE_LIMIT_PER_IP) return { limited: true, scope: "ip" };
  return { limited: false };
}

/**
 * The client IP behind Vercel's proxy.
 *
 * `x-forwarded-for` can carry several: the first is the real client and the rest
 * are intermediate proxies.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || null;
}

/**
 * The IP of the person who filled in the form.
 *
 * With a public key the browser posts straight to us, so it's the request's own
 * IP. With a secret key the site's server posts on the person's behalf, and the
 * request's IP is that server's — the same for every customer, which would trip
 * the per-IP limit after a handful of enquiries. A server holding a secret key
 * is trusted to tell us the real one in `X-Client-Ip`; without it, only the
 * per-key limit applies.
 */
export function submitterIp(headers: Headers, keyType: "PUBLIC" | "SECRET"): string | null {
  if (keyType === "PUBLIC") return clientIp(headers);

  const forwarded = headers.get("x-client-ip")?.trim();
  return forwarded && isIP(forwarded) !== 0 ? forwarded : null;
}
