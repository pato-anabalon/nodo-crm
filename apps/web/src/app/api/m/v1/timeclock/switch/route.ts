import { jobIn } from "@/modules/mobile/jobs/guard";
import { mobileRoute } from "@/modules/mobile/route";
import { switchSite } from "@/modules/timeclock/movement-service";
import { switchSchema } from "@/modules/timeclock/schemas";

/**
 * Arriving at another job and taking it up in one press: `from` ends and the
 * shift on `jobId` starts, at the same instant. Held to a clock-in's refusals
 * (`outside`, `imprecise`, `no_site`, `consent_required`), plus `same_job`.
 */
export const POST = mobileRoute({
  permission: "timeclock.punch",
  body: switchSchema,
  handler: async ({ ctx: base, body }) => {
    const { ctx, job } = await jobIn(base, body.jobId, "timeclock.punch");
    return switchSite(ctx, job, { fromClientId: body.from, clientId: body.clientId, at: body.at, fix: body.fix, battery: body.battery });
  },
});
