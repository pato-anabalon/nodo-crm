import { consentSchema } from "@/modules/timeclock/schemas";
import { setConsent } from "@/modules/timeclock/service";
import { mobileRoute } from "@/modules/mobile/route";

/**
 * Agreeing, in this company, to the position being recorded between clocking
 * in and out — or taking it back, which is refused while a shift is open. The
 * screen that asks says what is recorded, when and for how long.
 */
export const PUT = mobileRoute({
  permission: "timeclock.punch",
  body: consentSchema,
  handler: async ({ ctx, body }) => {
    const consentAt = await setConsent(ctx, body.consent);
    return { consentAt: consentAt?.toISOString() ?? null };
  },
});
