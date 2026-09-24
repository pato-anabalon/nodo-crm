"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { RoleKey } from "@/generated/prisma/enums";
import { ROOT_DOMAIN } from "@/lib/tenant/host";
import { invitationUrl } from "./invitations";
import { sendInvitationEmail } from "./email";
import { inviteSchema } from "./schemas";
import { setRolePermissions } from "./roles";
import {
  changeMemberRole,
  inviteMember,
  reactivateMember,
  removeMember,
  revokeInvitation,
  suspendMember,
  type MemberOutcome,
} from "./service";

export type TeamState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

/** Turns a refusal from the rules into something a person can read. */
async function explain(outcome: MemberOutcome): Promise<TeamState> {
  if (outcome.ok) {
    revalidatePath("/settings/team");
    const t = await getTranslations("team");
    return { message: t("saved") };
  }

  const t = await getTranslations("team.errors");
  return { error: t(outcome.reason === "not-found" ? "notFound" : outcome.reason) };
}

export async function inviteMemberAction(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const ctx = await requirePermission("users.invite");
  const t = await getTranslations();

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    roleKey: formData.get("roleKey"),
  });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const result = await inviteMember(ctx, parsed.data);
  if (!result.ok) return { error: t("team.errors.alreadyMember") };

  const url = invitationUrl(ctx.company.slug, result.token, ROOT_DOMAIN);

  // Outside the response, like every other notice: a slow mail provider must not
  // make the invitation look as though it failed.
  after(async () => {
    await sendInvitationEmail({
      to: parsed.data.email,
      companyName: ctx.company.name,
      inviterName: ctx.user.name ?? ctx.user.email,
      roleName: t(`roles.${parsed.data.roleKey}.name`),
      url,
      language: ctx.company.defaultLanguage,
    });
  });

  revalidatePath("/settings/team");
  return { message: t("team.invited", { email: parsed.data.email }) };
}

export async function revokeInvitationAction(id: string): Promise<TeamState> {
  const ctx = await requirePermission("users.invite");
  const t = await getTranslations("team");

  const done = await revokeInvitation(ctx, id);
  revalidatePath("/settings/team");
  return done ? { message: t("invitationRevoked") } : { error: t("errors.notFound") };
}

export async function changeMemberRoleAction(userId: string, roleKey: string): Promise<TeamState> {
  const ctx = await requirePermission("users.update");
  if (!(roleKey in RoleKey)) {
    const t = await getTranslations("team.errors");
    return { error: t("notFound") };
  }
  return explain(await changeMemberRole(ctx, userId, roleKey as RoleKey));
}

export async function suspendMemberAction(userId: string): Promise<TeamState> {
  const ctx = await requirePermission("users.update");
  return explain(await suspendMember(ctx, userId));
}

export async function reactivateMemberAction(userId: string): Promise<TeamState> {
  const ctx = await requirePermission("users.update");
  return explain(await reactivateMember(ctx, userId));
}

export async function removeMemberAction(userId: string): Promise<TeamState> {
  const ctx = await requirePermission("users.remove");
  return explain(await removeMember(ctx, userId));
}

export async function saveRolePermissionsAction(
  roleId: string,
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const ctx = await requirePermission("roles.update");
  const t = await getTranslations("team");

  // The grid submits the whole set; anything unticked simply isn't here.
  const keys = formData.getAll("permissions").map(String);
  const result = await setRolePermissions(ctx, roleId, keys);

  if (!result.ok) {
    const tErrors = await getTranslations("team.errors");
    return { error: tErrors(result.reason === "locked" ? "ownerLocked" : "notFound") };
  }

  revalidatePath("/settings/profiles", "layout");
  return { message: t("saved") };
}
