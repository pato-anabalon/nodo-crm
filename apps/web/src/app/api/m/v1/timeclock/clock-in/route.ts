import { jobIn } from "@/modules/mobile/jobs/guard";
import { mobileRoute } from "@/modules/mobile/route";
import { clockInSchema } from "@/modules/timeclock/schemas";
import { clockIn } from "@/modules/timeclock/service";

/**
 * Clocking in on a job this person can see and isn't finished. Sent again with
 * the same `clientId` it answers with the shift the first one made
 * (`created: false`), so a punch queued without signal can be sent until it
 * lands. Refused away from the job (`outside`, with how far), on a fix too
 * vague (`imprecise`), on a job with no place (`no_site`), before consent
 * (`consent_required`) and with a shift already open (`already_clocked_in`).
 */
export const POST = mobileRoute({
  permission: "timeclock.punch",
  body: clockInSchema,
  handler: async ({ ctx: base, body }) => {
    const { ctx, job } = await jobIn(base, body.jobId, "timeclock.punch");
    return clockIn(ctx, job, { clientId: body.clientId, at: body.at, fix: body.fix, battery: body.battery });
  },
});
