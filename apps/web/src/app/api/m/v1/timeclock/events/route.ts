import { mobileRoute } from "@/modules/mobile/route";
import { recordSiteEvents } from "@/modules/timeclock/movement-service";
import { siteEventsSchema } from "@/modules/timeclock/schemas";

/**
 * Leaving and coming back to the job, and errands, for the shift clocked in
 * with `entry`, in whatever order the phone's queue holds them. One sent again
 * is stored once (`stored` counts the new ones). Answers with the shift open
 * after them — null when the clock ended it for being away too long.
 */
export const POST = mobileRoute({
  permission: "timeclock.punch",
  body: siteEventsSchema,
  handler: async ({ ctx, body }) => recordSiteEvents(ctx, body.entry, body.events),
});
