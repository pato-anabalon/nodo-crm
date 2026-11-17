import { forgetPushDevice, registerPushDevice } from "@/modules/mobile/push";
import { mobileUserRoute } from "@/modules/mobile/route";
import { pushDeviceSchema } from "@/modules/mobile/schemas";

/**
 * Where this phone takes notices. Sent after the person allows notifications,
 * and again whenever the app starts — a token can change, and sending the same
 * one twice changes nothing. No company: a notice from any of the person's
 * companies reaches the phone, carrying the company to switch to.
 */
export const PUT = mobileUserRoute({
  body: pushDeviceSchema,
  handler: async ({ session, body }) => {
    await registerPushDevice(session.id, body.token, body.platform);
    return { ok: true };
  },
});

/** Notices off on this phone, still signed in — the person turned them off in the app. */
export const DELETE = mobileUserRoute({
  handler: async ({ session }) => {
    await forgetPushDevice(session.id);
    return { ok: true };
  },
});
