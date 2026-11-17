import { mobileRoute } from "@/modules/mobile/route";
import { clockOutSchema } from "@/modules/timeclock/schemas";
import { clockOut } from "@/modules/timeclock/service";

/**
 * Ending the shift clocked in with `entry`. Not behind the job's guard: a job
 * finished or taken away mid-shift must not leave somebody unable to stop the
 * clock. A shift already ended answers as it is (`changed: false`).
 */
export const POST = mobileRoute({
  permission: "timeclock.punch",
  body: clockOutSchema,
  handler: async ({ ctx, body }) =>
    clockOut(ctx, { entryClientId: body.entry, at: body.at, fix: body.fix, battery: body.battery }),
});
