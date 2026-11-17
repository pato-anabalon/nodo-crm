import { clientIp } from "@/lib/auth/login-rate-limit";
import { signInWithPassword } from "@/modules/mobile/auth";
import { mobilePublicRoute } from "@/modules/mobile/route";
import { passwordSignInSchema } from "@/modules/mobile/schemas";

/** Email and password. Answers with a session on a trusted phone, otherwise with a code to enter. */
export const POST = mobilePublicRoute({
  body: passwordSignInSchema,
  handler: ({ body, request }) => signInWithPassword(body, clientIp(request.headers)),
});
