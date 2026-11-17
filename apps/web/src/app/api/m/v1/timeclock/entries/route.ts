import { addDays, isDay } from "@nodo/core/jobs/schedule/calendar";
import { zonedInstant } from "@nodo/core/zoned-time";
import { today } from "@/modules/mobile/jobs/views";
import { mobileRoute, MobileError } from "@/modules/mobile/route";
import { ownEntries } from "@/modules/timeclock/service";

/** The longest window asked for at once. */
const MAX_DAYS = 62;

/**
 * This person's own shifts that started from `?from=` to `?to=` — days on the
 * company's calendar, inclusive; the last seven without them. Somebody else's
 * hours are `/timesheets` on the web, behind `timeclock.read.all`.
 */
export const GET = mobileRoute({
  permission: "timeclock.punch",
  handler: async ({ ctx, request }) => {
    const search = new URL(request.url).searchParams;
    const to = search.get("to") ?? today(ctx);
    const from = search.get("from") ?? addDays(to, -6);
    if (!isDay(from) || !isDay(to) || to < from || addDays(from, MAX_DAYS) < to) {
      throw new MobileError(400, "invalid_range");
    }

    const zone = ctx.company.timezone;
    const entries = await ownEntries(ctx, zonedInstant(from, "00:00", zone), zonedInstant(addDays(to, 1), "00:00", zone));
    return { from, to, entries };
  },
});
