"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { ROOT_DOMAIN } from "@/lib/tenant/host";
import { invitationUrl } from "./invitations";
import { sendInvitationEmail } from "./email";
import { createRoleSchema, inviteSchema, roleNameSchema } from "./schemas";
import { isRoleNameTaken, roleDisplayName } from "@/lib/auth/role-name";
import { createRole, deleteRole, renameRole, setRolePermissions } from "./roles";
import {
  changeMemberRole,
  inviteMember,
  listCompanyRoles,
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
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const result = await inviteMember(ctx, parsed.data);
  if (!result.ok) {
    return { error: t(result.reason === "role-not-found" ? "team.errors.roleNotFound" : "team.errors.alreadyMember") };
  }

  const url = invitationUrl(ctx.company.slug, result.token, ROOT_DOMAIN);

  // The company's own name for the profile when it has one, so the email says
  // what the team screen says.
  const role = await ctx.db.role.findFirst({
    where: { id: parsed.data.roleId },
    select: { key: true, name: true },
  });
  const tRoles = await getTranslations("roles");
  const roleName = role ? roleDisplayName(role, tRoles) : "";

  // Outside the response, like every other notice: a slow mail provider must not
  // make the invitation look as though it failed.
  after(async () => {
    await sendInvitationEmail({
      to: parsed.data.email,
      companyName: ctx.company.name,
      inviterName: ctx.user.name ?? ctx.user.email,
      roleName,
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

export async function changeMemberRoleAction(userId: string, roleId: string): Promise<TeamState> {
  const ctx = await requirePermission("users.update");
  return explain(await changeMemberRole(ctx, userId, roleId));
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

export async function renameRoleAction(
  roleId: string,
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const ctx = await requirePermission("roles.update");
  const t = await getTranslations();

  const parsed = roleNameSchema.safeParse({ name: formData.get("name") ?? "" });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  // Only a name can clash; going back to the standard one (null) never does.
  if (parsed.data.name) {
    const roles = await listCompanyRoles(ctx);
    if (isRoleNameTaken(roles, parsed.data.name, await getTranslations("roles"), roleId)) {
      return { fieldErrors: { name: [t("team.errors.nameTaken")] } };
    }
  }

  const result = await renameRole(ctx, roleId, parsed.data.name);
  if (!result.ok) {
    return result.reason === "name-required"
      ? { fieldErrors: { name: [t("validation.required")] } }
      : { error: t("team.errors.roleNotFound") };
  }

  // Everywhere that names a profile: this screen, the list, the team and the
  // sidebar's "Profile: …".
  revalidatePath("/", "layout");
  return { message: t("team.saved") };
}

export async function createRoleAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const ctx = await requirePermission("roles.update");
  const t = await getTranslations();

  const parsed = createRoleSchema.safeParse({
    name: formData.get("name") ?? "",
    copyFrom: formData.get("copyFrom") ?? "",
  });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const roles = await listCompanyRoles(ctx);
  if (isRoleNameTaken(roles, parsed.data.name, await getTranslations("roles"))) {
    return { fieldErrors: { name: [t("team.errors.nameTaken")] } };
  }

  const result = await createRole(ctx, parsed.data);
  if (!result.ok) return { error: t("team.errors.roleNotFound") };

  revalidatePath("/settings/profiles", "layout");
  // Straight to its features: a profile with nothing ticked (or somebody else's
  // ticks) isn't finished, and that grid is the next thing anybody wants.
  redirect(`/settings/profiles/${result.id}`);
}

export async function deleteRoleAction(roleId: string): Promise<TeamState> {
  const ctx = await requirePermission("roles.update");
  const t = await getTranslations("team.errors");

  const result = await deleteRole(ctx, roleId);
  if (!result.ok) {
    if (result.reason === "in-use") {
      // People first: they are what has to be moved by hand. Only when nobody
      // holds it is it the waiting invitations that stand in the way.
      return {
        error:
          result.members > 0
            ? t("roleInUse", { count: result.members })
            : t("roleInvited", { count: result.invitations }),
      };
    }
    return { error: t(result.reason === "owner" ? "roleOwner" : "roleNotFound") };
  }

  revalidatePath("/settings/profiles", "layout");
  redirect("/settings/profiles");
}
