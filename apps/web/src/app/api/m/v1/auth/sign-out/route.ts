import { signOut } from "@/modules/mobile/auth";
import { mobileUserRoute } from "@/modules/mobile/route";

export const POST = mobileUserRoute({
  handler: async ({ session }) => {
    await signOut(session.id);
    return { ok: true };
  },
});
