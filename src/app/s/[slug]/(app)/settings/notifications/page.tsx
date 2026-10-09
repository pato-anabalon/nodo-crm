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
  const [t, tNav] = await Promise.all([
    getTranslations("notificationSettings"),
    getTranslations("nav"),
  ]);

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

  // Reached from the sidebar's own Settings for an owner or admin, but from
  // the user menu for anyone else — a Sales or Viewer profile has no
  // `settings.read` and would hit a forbidden page clicking "Back to
  // Settings" otherwise, since that index is exactly what they can't open.
  const back = can(ctx, "settings.read")
    ? undefined
    : { href: "/", label: tNav("dashboard") };

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("title")} subtitle={t("subtitle", { company: ctx.company.name })} back={back} />

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
