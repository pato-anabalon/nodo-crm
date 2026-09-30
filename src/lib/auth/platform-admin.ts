import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Whoever operates the platform itself — not a company's own OWNER, who is
 * bounded to their one company by `requireCompanyContext()`. There's no
 * membership to check here, so the allowlist is the only guard: a comma
 * separated env var rather than a role, because there is exactly one of these
 * today and a `Role` row belongs to a company.
 */
function platformAdminEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return platformAdminEmails().has(email.toLowerCase());
}

/**
 * Guards the platform's own admin screens.
 *
 * A signed-in user who isn't on the list is sent to the public site rather
 * than told why: same reason an ingest rejection is mute — this route isn't
 * confirming its own existence to somebody it just turned away.
 */
export async function requirePlatformAdmin(): Promise<{ email: string }> {
  const session = await auth();
  const email = session?.user?.email;

  if (!email || !isPlatformAdmin(email)) {
    redirect(session?.user?.id ? "/" : "/sign-in");
  }

  return { email };
}
