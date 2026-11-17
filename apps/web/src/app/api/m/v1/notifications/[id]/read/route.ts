import { markRead } from "@/modules/notifications/inbox";
import { mobileRoute } from "@/modules/mobile/route";

/** Opening a notice marks it read; only the reader's own, and a second time changes nothing. */
export const POST = mobileRoute({
  handler: async ({ ctx, params }) => {
    await markRead(ctx, String(params.id));
    return { ok: true };
  },
});
