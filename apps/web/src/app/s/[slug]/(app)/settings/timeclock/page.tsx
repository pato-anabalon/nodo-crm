import { getTranslations } from "next-intl/server";
import { can, requirePermission } from "@/lib/auth/session";
import { SettingsHeader } from "@/modules/settings/settings-header";
import { saveBreakPolicyAction, saveMovementPolicyAction, saveRetentionAction } from "@/modules/timeclock/actions";
import { BreakPolicyForm } from "@/modules/timeclock/break-policy-form";
import { MovementPolicyForm } from "@/modules/timeclock/movement-policy-form";
import { RetentionForm } from "@/modules/timeclock/retention-form";

export async function generateMetadata() {
  const t = await getTranslations("timeclockSettings");
  return { title: t("title") };
}

export default async function TimeclockSettingsPage() {
  const ctx = await requirePermission("settings.read");
  const t = await getTranslations("timeclockSettings");

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("title")} subtitle={t("subtitle")} />
      <BreakPolicyForm policy={ctx.company.breakPolicy} canEdit={can(ctx, "settings.update")} save={saveBreakPolicyAction} />
      <MovementPolicyForm policy={ctx.company.movementPolicy} canEdit={can(ctx, "settings.update")} save={saveMovementPolicyAction} />
      <RetentionForm days={ctx.company.locationRetentionDays} canEdit={can(ctx, "settings.update")} save={saveRetentionAction} />
    </div>
  );
}
