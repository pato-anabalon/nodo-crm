import { getTranslations } from "next-intl/server";
import { can, requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { RoleKey } from "@/generated/prisma/enums";
import { listTeam } from "@/modules/team/service";
import { TeamManager } from "@/modules/team/team-manager";
import { SettingsHeader } from "@/modules/settings/settings-header";

export async function generateMetadata() {
  const t = await getTranslations("team");
  return { title: t("title") };
}

export default async function TeamPage() {
  const ctx = await requirePermission("users.read");
  const t = await getTranslations("team");
  const { members, invitations } = await listTeam(ctx);

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("title")} subtitle={t("subtitle")} />

      <TeamManager
        members={members}
        invitations={invitations.map((invitation) => ({
          id: invitation.id,
          email: invitation.email,
          roleKey: invitation.roleKey,
          // Formatted here: the company's format and zone, not the reader's.
          expiresLabel: formatDate(
            invitation.expiresAt,
            ctx.company.formatLocale,
            ctx.company.timezone,
          ),
          expired: invitation.expired,
        }))}
        roles={Object.values(RoleKey)}
        canInvite={can(ctx, "users.invite")}
        canUpdate={can(ctx, "users.update")}
        canRemove={can(ctx, "users.remove")}
      />
    </div>
  );
}
