import { NextResponse } from "next/server";

/**
 * The guard on every route Vercel Cron calls: a shared secret and nothing
 * else, since there is no session. Returns the response to answer with when
 * the request isn't the scheduler's, or null to go on.
 *
 * Refusing to run is safer than running unguarded: a missing secret in an
 * environment is a configuration mistake, not permission to skip the check
 * (503). The comparison is length-safe rather than `===`, so a wrong secret
 * can't be teased out a character at a time from how long the answer takes.
 */
export function cronRefusal(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) return new NextResponse(null, { status: 503 });

  const offered = request.headers.get("authorization") ?? "";
  if (!safeEqual(offered, `Bearer ${expected}`)) return new NextResponse(null, { status: 401 });
  return null;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
