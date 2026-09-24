import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { roleDisplayName } from "@/lib/auth/role-name";
import { listCompanyRoles } from "@/modules/team/service";
import { SettingsHeader } from "@/modules/settings/settings-header";

export async function generateMetadata() {
  const t = await getTranslations("team.profiles");
  return { title: t("title") };
}

export default async function ProfilesPage() {
  const ctx = await requirePermission("roles.read");
  const [t, tRoles] = await Promise.all([
    getTranslations("team.profiles"),
    getTranslations("roles"),
  ]);
  const roles = await listCompanyRoles(ctx);

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("title")} subtitle={t("subtitle")} />

      <Card>
        <CardContent className="divide-y p-0">
          {roles.map((role) => (
            <Link
              key={role.id}
              href={`/settings/profiles/${role.id}`}
              className="flex items-center gap-3 p-4 hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {roleDisplayName({ key: role.key, name: role.name }, tRoles)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("counts", { features: role.permissionCount, people: role.memberCount })}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
