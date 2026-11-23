import { clockableJobs, consentOf, openEntry } from "@/modules/timeclock/service";
import { mobileRoute } from "@/modules/mobile/route";

/**
 * Everything the clock screen opens with: whether this person has agreed to
 * their position being recorded, the shift they have open, and the jobs they
 * can clock into with where each one is — which the phone keeps, so it can
 * tell somebody they're inside the circle with no signal — and the company's
 * rules for leaving one (`movement`), so it can count down without it too,
 * and how long positions are kept, which the consent says.
 */
export const GET = mobileRoute({
  permission: "timeclock.punch",
  handler: async ({ ctx }) => {
    const [consentAt, open, jobs] = await Promise.all([consentOf(ctx), openEntry(ctx), clockableJobs(ctx)]);
    return { consentAt: consentAt?.toISOString() ?? null, open, jobs, movement: ctx.company.movementPolicy, retentionDays: ctx.company.locationRetentionDays };
  },
});
