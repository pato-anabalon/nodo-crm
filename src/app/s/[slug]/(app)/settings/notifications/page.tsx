import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { preferenceMap } from "@/modules/notifications/preferences";
import { NotificationPreferencesForm } from "@/modules/notifications/preferences-form";
import { LeadRecipients } from "@/modules/notifications/lead-recipients";
import { SettingsHeader } from "@/modules/settings/settings-header";

export async function generateMetadata() {
  const t = await getTranslations("notificationSettings");
  return { title: t("title") };
}

/**
 * Personal notice settings. No permission required: these are the signed-in
 * person's own emails, not something the company decides for them.
 */
export default async function NotificationSettingsPage() {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("notificationSettings");

  const [stored, company] = await Promise.all([
    ctx.db.notificationPreference.findMany({
      where: { userId: ctx.user.id },
      select: { kind: true, enabled: true },
    }),
    ctx.db.company.findFirstOrThrow({
      where: { id: ctx.company.id },
      select: { leadNotificationEmails: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("title")} subtitle={t("subtitle", { company: ctx.company.name })} />

      <NotificationPreferencesForm preferences={preferenceMap(stored)} />

      {/* The company's own list, unlike everything above it: who else in the
          world receives its leads is not a personal choice. */}
      {can(ctx, "settings.read") ? (
        <LeadRecipients
          emails={company.leadNotificationEmails}
          canEdit={can(ctx, "settings.update")}
        />
      ) : null}
    </div>
  );
}
