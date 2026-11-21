import { mobileRoute } from "@/modules/mobile/route";
import { startTravel } from "@/modules/timeclock/movement-service";
import { travelSchema } from "@/modules/timeclock/schemas";

/**
 * "I'm going to another job": the shift in `entry` ends when they left it and
 * travel starts there. Not behind the job's guard, like clocking out: it is
 * leaving the job. Sent again with the same `clientId` it answers with the
 * travel the first one made (`created: false`).
 */
export const POST = mobileRoute({
  permission: "timeclock.punch",
  body: travelSchema,
  handler: async ({ ctx, body }) => startTravel(ctx, { entryClientId: body.entry, clientId: body.clientId, at: body.at }),
});
