import { NextResponse } from "next/server";
import { runDailySweep } from "@/modules/notifications/sweep";

/** Long enough to walk every company; the sweep is a handful of indexed reads each. */
export const maxDuration = 300;

/**
 * The once-a-day sweep, called by Vercel Cron.
 *
 * Guarded by a shared secret and nothing else: this route has no session, runs
 * on the root domain and writes for every company, so an open one would be a
 * way to make the platform email anybody on a schedule.
 *
 * Comparison is length-safe rather than `===` so a wrong secret can't be teased
 * out a character at a time from how long the answer takes.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;

  // Refusing to run is safer than running unguarded: a missing secret in an
  // environment is a configuration mistake, not permission to skip the check.
  if (!expected) return new NextResponse(null, { status: 503 });

  const offered = request.headers.get("authorization") ?? "";
  if (!safeEqual(offered, `Bearer ${expected}`)) {
    return new NextResponse(null, { status: 401 });
  }

  const result = await runDailySweep();
  return NextResponse.json(result);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
