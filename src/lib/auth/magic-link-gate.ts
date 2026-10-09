/**
 * Whether a magic-link sign-in may proceed: the email already belongs to an
 * active member of this company, or holds an invitation that's still open.
 *
 * Lives here, not in the login form's own server action, because that
 * action is one *path* to Auth.js's email provider — the framework's own
 * `/api/auth/signin/resend` route is another, mounted by the catch-all
 * handler in `src/app/api/auth/[...nextauth]/route.ts`, reachable directly
 * with no session and nothing routing through the form at all. A check that
 * only lives in the form's action is a check an attacker can skip entirely
 * by calling that route instead. This is called from `src/auth.ts`'s own
 * `signIn` callback, Auth.js's actual trust boundary, so it applies no
 * matter which door was used.
 */
import { prisma } from "@/lib/db/prisma";
import { MembershipStatus } from "@/generated/prisma/enums";
import { invitationState } from "@/modules/team/invitations";
import { clientIp, loginRateLimited, windowStart } from "./login-rate-limit";

export async function canRequestMagicLink(options: {
  slug: string;
  email: string;
  headers: Headers;
}): Promise<boolean> {
  const company = await prisma.company.findFirst({
    where: { slug: options.slug, isActive: true },
    select: { id: true },
  });
  if (!company) return false;

  const ip = clientIp(options.headers);

  const recentAttempts = await prisma.loginAttempt.count({
    where: { ipAddress: ip, createdAt: { gte: windowStart() } },
  });

  // Recorded whether or not this request goes on to be allowed: the limit
  // bounds how many requests an IP gets to make, not how many succeed.
  await prisma.loginAttempt.create({ data: { companyId: company.id, ipAddress: ip } });

  if (loginRateLimited(recentAttempts)) return false;

  const normalizedEmail = options.email.trim().toLowerCase();
  const [membership, invitation] = await Promise.all([
    prisma.membership.findFirst({
      where: {
        companyId: company.id,
        status: MembershipStatus.ACTIVE,
        user: { email: normalizedEmail },
      },
      select: { id: true },
    }),
    prisma.invitation.findUnique({
      where: { companyId_email: { companyId: company.id, email: normalizedEmail } },
      select: { status: true, expiresAt: true },
    }),
  ]);

  return Boolean(membership) || invitationState(invitation) === "ok";
}
