import { NextResponse } from "next/server";
import { cronRefusal } from "@/lib/cron-auth";
import { settleOpenEntries } from "@/modules/timeclock/settle";

/**
 * The clock's own sweep, every few minutes: shifts whose person left the job
 * and didn't come back in time, and travel past its limit, end even when the
 * phone that would have said so is flat or off. Reading the clock settles a
 * shift too; this is what makes the notice arrive while it still matters.
 * Only open shifts with something counting are read, so a quiet run is one
 * indexed query. Behind `CRON_SECRET`, like the daily sweep.
 */
export async function GET(request: Request) {
  const refused = cronRefusal(request);
  if (refused) return refused;

  return NextResponse.json({ autoClockOuts: await settleOpenEntries() });
}
