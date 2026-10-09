import bcrypt from "bcryptjs";
import type { CompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { meetsPasswordPolicy } from "@/lib/auth/password-policy";
import { InvitationStatus, MembershipStatus, RoleKey } from "@/generated/prisma/enums";
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  invitationState,
} from "./invitations";
import { refuseMemberChange, type MemberChange, type Refusal } from "./rules";

/** Active members of the company, for the assignment selectors. */
export async function listCompanyMembers(ctx: CompanyContext) {
  const memberships = await ctx.db.membership.findMany({
    where: { status: MembershipStatus.ACTIVE },
    include: {
      user: { select: { id: true, name: true, email: true } },
      role: { select: { key: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    userId: m.user.id,
    name: m.user.name ?? m.user.email,
    email: m.user.email,
    roleName: m.role.name,
  }));
}

/** Everyone in the company, suspended included, plus who has been invited. */
export async function listTeam(ctx: CompanyContext) {
  const [memberships, invitations] = await Promise.all([
    ctx.db.membership.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        role: { select: { id: true, key: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
    ctx.db.invitation.findMany({
      where: { status: InvitationStatus.PENDING },
      include: { role: { select: { key: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const now = new Date();

  return {
    members: memberships.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      roleId: m.role.id,
      roleKey: m.role.key,
      roleName: m.role.name,
      status: m.status,
      isSelf: m.user.id === ctx.user.id,
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      roleKey: i.role.key,
      roleName: i.role.name,
      expiresAt: i.expiresAt,
      // Nothing sweeps the table, so a pending row may simply have run out.
      expired: invitationState(i, now) === "expired",
    })),
  };
}

/** The company's profiles, with how many features each one currently holds. */
export async function listCompanyRoles(ctx: CompanyContext) {
  const roles = await ctx.db.role.findMany({
    include: { _count: { select: { permissions: true, memberships: true } } },
  });

  const order = Object.values(RoleKey);
  return roles
    .map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      permissionCount: role._count.permissions,
      memberCount: role._count.memberships,
    }))
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

/** How many owners can still administer the company right now. */
export async function countActiveOwners(ctx: CompanyContext): Promise<number> {
  return ctx.db.membership.count({
    where: { status: MembershipStatus.ACTIVE, role: { key: RoleKey.OWNER } },
  });
}

export type MemberOutcome =
  | { ok: true }
  | { ok: false; reason: Refusal | "not-found" };

/**
 * Applies a change to somebody's membership, after the guards have their say.
 *
 * The snapshot and the owner count are read here rather than passed in, so a
 * caller can't accidentally decide on stale figures — the rules only work if
 * they see the company as it is at the moment of the change.
 */
async function changeMember(
  ctx: CompanyContext,
  userId: string,
  change: MemberChange,
): Promise<MemberOutcome> {
  const membership = await ctx.db.membership.findFirst({
    where: { userId },
    select: { id: true, status: true, role: { select: { key: true } } },
  });
  if (!membership) return { ok: false, reason: "not-found" };

  const refusal = refuseMemberChange(
    ctx.user.id,
    { userId, roleKey: membership.role.key, status: membership.status },
    change,
    await countActiveOwners(ctx),
  );
  if (refusal) return { ok: false, reason: refusal };

  if (change.kind === "remove") {
    await ctx.db.membership.deleteMany({ where: { id: membership.id } });
    return { ok: true };
  }

  const data =
    change.kind === "role"
      ? { roleId: await roleIdFor(ctx, change.to) }
      : { status: change.kind === "suspend" ? MembershipStatus.SUSPENDED : MembershipStatus.ACTIVE };

  await ctx.db.membership.updateMany({ where: { id: membership.id }, data });
  return { ok: true };
}

async function roleIdFor(ctx: CompanyContext, key: RoleKey): Promise<string> {
  const role = await ctx.db.role.findFirstOrThrow({ where: { key }, select: { id: true } });
  return role.id;
}

export const changeMemberRole = (ctx: CompanyContext, userId: string, to: RoleKey) =>
  changeMember(ctx, userId, { kind: "role", to });

export const suspendMember = (ctx: CompanyContext, userId: string) =>
  changeMember(ctx, userId, { kind: "suspend" });

export const reactivateMember = (ctx: CompanyContext, userId: string) =>
  changeMember(ctx, userId, { kind: "reactivate" });

export const removeMember = (ctx: CompanyContext, userId: string) =>
  changeMember(ctx, userId, { kind: "remove" });

export type InviteOutcome =
  | { ok: true; token: string }
  | { ok: false; reason: "already-member" };

/**
 * Invites somebody, or re-invites them.
 *
 * One invitation per address per company, so inviting again mints a fresh token
 * on the same row and the previous link stops working — the stored hash can't be
 * turned back into the old one anyway.
 */
export async function inviteMember(
  ctx: CompanyContext,
  input: { email: string; roleKey: RoleKey },
): Promise<InviteOutcome> {
  const email = input.email.trim().toLowerCase();

  const already = await ctx.db.membership.findFirst({
    where: { user: { email } },
    select: { id: true },
  });
  if (already) return { ok: false, reason: "already-member" };

  const roleId = await roleIdFor(ctx, input.roleKey);
  const { token, hashedToken } = generateInvitationToken();
  const expiresAt = invitationExpiry();

  await ctx.db.invitation.upsert({
    where: { companyId_email: { companyId: ctx.company.id, email } },
    create: {
      companyId: ctx.company.id,
      email,
      roleId,
      hashedToken,
      expiresAt,
      status: InvitationStatus.PENDING,
    },
    update: {
      roleId,
      hashedToken,
      expiresAt,
      status: InvitationStatus.PENDING,
      acceptedAt: null,
    },
  });

  return { ok: true, token };
}

export async function revokeInvitation(ctx: CompanyContext, id: string): Promise<boolean> {
  const { count } = await ctx.db.invitation.updateMany({
    where: { id, status: InvitationStatus.PENDING },
    data: { status: InvitationStatus.REVOKED },
  });
  return count > 0;
}

/**
 * The invitation behind a link, for the page that has no session yet.
 *
 * Goes through `prisma` and not `ctx.db` for the same reason the customer's
 * portal does: whoever opens this has no membership anywhere, and the token is
 * the only thing vouching for them.
 */
export async function resolveInvitation(token: string) {
  if (!token || token.length < 20) return { state: "not-found" as const, invitation: null };

  const invitation = await prisma.invitation.findUnique({
    where: { hashedToken: hashInvitationToken(token) },
    include: {
      company: { select: { id: true, slug: true, name: true, logoUrl: true } },
      role: { select: { id: true, key: true, name: true } },
    },
  });

  return { state: invitationState(invitation), invitation };
}

export type AcceptOutcome =
  | { ok: true; slug: string }
  | { ok: false; reason: "invalid" | "wrong-account" };

/**
 * Turns an invitation into a membership.
 *
 * The signed-in address has to be the one that was invited. Otherwise a
 * forwarded email would let whoever opened it walk into the company — and the
 * person who sent it would have no way of knowing.
 */
export async function acceptInvitation(token: string, user: { id: string; email: string }): Promise<AcceptOutcome> {
  const { state, invitation } = await resolveInvitation(token);
  if (state !== "ok" || !invitation) return { ok: false, reason: "invalid" };

  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, reason: "wrong-account" };
  }

  await prisma.$transaction([
    prisma.membership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: invitation.companyId } },
      create: {
        userId: user.id,
        companyId: invitation.companyId,
        roleId: invitation.roleId,
        status: MembershipStatus.ACTIVE,
      },
      // Somebody removed and invited again keeps the same row.
      update: { roleId: invitation.roleId, status: MembershipStatus.ACTIVE },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
    }),
  ]);

  return { ok: true, slug: invitation.company.slug };
}

/**
 * Whether the invited address already has a password, so the join screen can
 * ask the right question — "choose a password" for whoever's new, "enter
 * your password" for somebody invited into a second company who already has
 * one from the first.
 */
export async function hasExistingPassword(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { passwordHash: true },
  });
  return Boolean(user?.passwordHash);
}

export type AcceptWithPasswordOutcome =
  | { ok: true; slug: string }
  | { ok: false; reason: "invalid" | "wrong-password" | "weak-password" };

/**
 * Turns an invitation into both a membership and an account, for whoever has
 * no session yet — the ordinary case, since an invitation is often the first
 * time somebody reaches the company at all.
 *
 * The token already proves they hold the invited address, the same guarantee
 * the link itself rests on, so there's no separate magic-link round trip:
 * typing a password here is what signs them up. If that address already has
 * one — invited into a second company, say — it's checked rather than
 * silently replaced, and a wrong one reads exactly like a bad password
 * anywhere else in the app. `meetsPasswordPolicy` only gates a *new*
 * password: an account from before the policy existed must go on signing in
 * with whatever it already has.
 */
export async function acceptInvitationWithPassword(
  token: string,
  password: string,
): Promise<AcceptWithPasswordOutcome> {
  const { state, invitation } = await resolveInvitation(token);
  if (state !== "ok" || !invitation) return { ok: false, reason: "invalid" };

  const email = invitation.email.toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  let userId: string;
  if (!existing || !existing.passwordHash) {
    if (!meetsPasswordPolicy(password)) return { ok: false, reason: "weak-password" };
    const passwordHash = await bcrypt.hash(password, 10);

    if (!existing) {
      userId = (await prisma.user.create({ data: { email, passwordHash } })).id;
    } else {
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });
      userId = existing.id;
    }
  } else {
    const valid = await bcrypt.compare(password, existing.passwordHash);
    if (!valid) return { ok: false, reason: "wrong-password" };
    userId = existing.id;
  }

  await prisma.$transaction([
    prisma.membership.upsert({
      where: { userId_companyId: { userId, companyId: invitation.companyId } },
      create: { userId, companyId: invitation.companyId, roleId: invitation.roleId, status: MembershipStatus.ACTIVE },
      update: { roleId: invitation.roleId, status: MembershipStatus.ACTIVE },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
    }),
  ]);

  return { ok: true, slug: invitation.company.slug };
}
