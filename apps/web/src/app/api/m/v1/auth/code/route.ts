import { signInWithCode } from "@/modules/mobile/auth";
import { mobilePublicRoute } from "@/modules/mobile/route";
import { codeSignInSchema } from "@/modules/mobile/schemas";

/** The emailed code, which turns a correct password into a session. */
export const POST = mobilePublicRoute({
  body: codeSignInSchema,
  handler: ({ body }) => signInWithCode(body),
});
