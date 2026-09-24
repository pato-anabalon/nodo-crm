import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { can, requirePermission } from "@/lib/auth/session";
import { roleDisplayName } from "@/lib/auth/role-name";
import {
  PERMISSION_MODULES,
  permissionMessageKey,
  permissionsByModule,
} from "@/lib/auth/permissions";
import { getRoleDetail } from "@/modules/team/roles";
import { saveRolePermissionsAction } from "@/modules/team/actions";
import { PermissionGrid } from "@/modules/team/permission-grid";
import { SettingsHeader } from "@/modules/settings/settings-header";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("roles.read");
  const [t, tRoles, tModules, tPermissions] = await Promise.all([
    getTranslations("team.profiles"),
    getTranslations("roles"),
    getTranslations("permissionModules"),
    getTranslations("permissions"),
  ]);

  const role = await getRoleDetail(ctx, id);
  if (!role) notFound();

  const grouped = permissionsByModule();
  const groups = PERMISSION_MODULES.map((module) => ({
    module,
    label: tModules(module),
    permissions: grouped[module].map((permission) => ({
      key: permission,
      // The key has a dot and next-intl reads that as a namespace, so the
      // messages hold it with an underscore.
      label: tPermissions(permissionMessageKey(permission)),
    })),
  }));

  return (
    <div className="space-y-6">
      {/* Back to Profiles, not to the index: this screen hangs off that one. */}
      <SettingsHeader
        title={roleDisplayName({ key: role.key, name: role.name }, tRoles)}
        subtitle={t("gridSubtitle")}
        back={{ href: "/settings/profiles", label: t("title") }}
      />

      <PermissionGrid
        groups={groups}
        granted={role.permissions}
        editable={role.editable}
        canEdit={can(ctx, "roles.update")}
        action={saveRolePermissionsAction.bind(null, role.id)}
      />
    </div>
  );
}
