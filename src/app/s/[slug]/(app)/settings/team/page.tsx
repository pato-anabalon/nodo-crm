import { getTranslations } from "next-intl/server";
import { can, requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { RoleKey } from "@/generated/prisma/enums";
import { roleDisplayName } from "@/lib/auth/role-name";
import { listCompanyRoles, listTeam } from "@/modules/team/service";
import { TeamManager } from "@/modules/team/team-manager";
import { SettingsHeader } from "@/modules/settings/settings-header";
import { listTrades } from "@/modules/jobs/service";
import { setMemberTradesAction } from "@/modules/jobs/actions";

export async function generateMetadata() {
  const t = await getTranslations("team");
  return { title: t("title") };
}

export default async function TeamPage() {
  const ctx = await requirePermission("users.read");
  const [t, tRoles] = await Promise.all([getTranslations("team"), getTranslations("roles")]);
  const [{ members, invitations }, trades, companyRoles] = await Promise.all([
    listTeam(ctx),
    listTrades(ctx),
    listCompanyRoles(ctx),
  ]);

  // The company's own names where it set them. Built here because the client
  // component can't be handed the function that decides it.
  // Labelled here because the client component can't be handed the function
  // that decides between the company's own name and the translated standard one.
  const roles = companyRoles.map((role) => ({
    id: role.id,
    label: roleDisplayName({ key: role.key, name: role.name }, tRoles),
  }));
  const defaultRoleId = companyRoles.find((role) => role.key === RoleKey.SALES)?.id ?? roles[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("title")} subtitle={t("subtitle")} />

      <TeamManager
        members={members}
        invitations={invitations.map((invitation) => ({
          id: invitation.id,
          email: invitation.email,
          roleId: invitation.roleId,
          // Formatted here: the company's format and zone, not the reader's.
          expiresLabel: formatDate(
            invitation.expiresAt,
            ctx.company.formatLocale,
            ctx.company.timezone,
          ),
          expired: invitation.expired,
        }))}
        roles={roles}
        defaultRoleId={defaultRoleId}
        canInvite={can(ctx, "users.invite")}
        canUpdate={can(ctx, "users.update")}
        canRemove={can(ctx, "users.remove")}
        trades={trades.map((trade) => ({ id: trade.id, name: trade.name }))}
        onSetTrades={setMemberTradesAction}
      />
    </div>
  );
}
