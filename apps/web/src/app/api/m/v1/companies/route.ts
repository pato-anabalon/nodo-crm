import { activeCompaniesFor } from "@/lib/auth/session";
import { mobileUserRoute } from "@/modules/mobile/route";

/** Where this person can work today. Asked again on opening the app, since a membership can end. */
export const GET = mobileUserRoute({
  handler: async ({ session }) => ({ companies: await activeCompaniesFor(session.userId) }),
});
