import { NextResponse } from "next/server";
import { cronRefusal } from "@/lib/cron-auth";
import { runDailySweep } from "@/modules/notifications/sweep";

/** Long enough to walk every company; the sweep is a handful of indexed reads each. */
export const maxDuration = 300;

/**
 * The once-a-day sweep, called by Vercel Cron, behind `CRON_SECRET`
 * (`cronRefusal`): this route has no session, runs on the root domain and
 * writes for every company, so an open one would be a way to make the
 * platform email anybody on a schedule.
 */
export async function GET(request: Request) {
  const refused = cronRefusal(request);
  if (refused) return refused;

  const result = await runDailySweep();
  return NextResponse.json(result);
}
