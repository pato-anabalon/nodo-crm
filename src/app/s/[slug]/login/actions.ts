"use server";

import { signIn } from "@/auth";

/**
 * Requests a magic-link sign-in email.
 *
 * The actual gate — is this email already a member, or does it hold an open
 * invitation? — lives in `src/auth.ts`'s own `signIn` callback via
 * `canRequestMagicLink`, not here: that's Auth.js's real trust boundary, the
 * one spot every path into the email provider has to pass through,
 * including the framework's own `/api/auth/signin/resend` route, which this
 * form's action was never the only way to reach. `signIn` returning `false`
 * there is what actually stops the email from sending.
 *
 * Returns nothing, and the caller shows the same message whatever
 * happened — a non-member, a rate-limited IP and a genuine send all read
 * identically, the same reason the password form's own error is
 * deliberately generic (see the comment in `login-form.tsx`).
 */
export async function requestMagicLink(email: string): Promise<void> {
  try {
    await signIn("resend", { email: email.trim().toLowerCase(), redirect: false });
  } catch {
    // A rejection from the `signIn` callback throws here (Auth.js's
    // `AccessDenied`) rather than returning — exactly the "nothing sent"
    // case the generic message already covers, so there's nothing more to
    // do with it.
  }
}
