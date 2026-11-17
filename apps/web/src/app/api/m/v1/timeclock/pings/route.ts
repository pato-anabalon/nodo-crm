import { mobileRoute } from "@/modules/mobile/route";
import { pingsSchema } from "@/modules/timeclock/schemas";
import { recordPings } from "@/modules/timeclock/service";

/**
 * A batch of positions for the shift clocked in with `entry`, sent every so
 * often rather than one by one — the radio costs the battery as much as the
 * GPS does. What fell outside the shift is dropped and counted (`outside`);
 * a batch sent twice is stored once.
 */
export const POST = mobileRoute({
  permission: "timeclock.punch",
  body: pingsSchema,
  handler: async ({ ctx, body }) => recordPings(ctx, body.entry, body.pings),
});
