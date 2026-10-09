import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SettingsHeader } from "@/modules/settings/settings-header";
import { ProfileForm } from "@/modules/account/profile-form";
import { AvatarManager } from "@/modules/account/avatar-manager";
import { ChangePasswordForm } from "@/modules/account/change-password-form";

export async function generateMetadata() {
  const t = await getTranslations("account");
  return { title: t("title") };
}

/**
 * The signed-in person's own name, photo and password. No permission
 * required, same reasoning as `/settings/notifications`: these belong to
 * whoever is signed in, not to something the company decides for them —
 * which is also what closes the gap a freshly-invited user hits today, where
 * `/join/<token>` sets a password but never asks for a name, so the sidebar
 * and the team list fall back to showing their email instead.
 */
export default async function ProfilePage() {
  const ctx = await requireCompanyContext();
  const [t, tNav] = await Promise.all([getTranslations("account"), getTranslations("nav")]);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.user.id },
    select: { passwordHash: true },
  });

  // Reached from the sidebar's own Settings for an owner or admin, but from
  // the user menu for anyone else — a Sales or Viewer profile has no
  // `settings.read` and would hit a forbidden page clicking "Back to
  // Settings" otherwise, since that index is exactly what they can't open.
  const back = can(ctx, "settings.read")
    ? undefined
    : { href: "/", label: tNav("dashboard") };

  return (
    <div className="space-y-6">
      <SettingsHeader title={t("title")} subtitle={t("subtitle")} back={back} />

      <AvatarManager name={ctx.user.name ?? ctx.user.email} image={ctx.user.image} />
      <ProfileForm name={ctx.user.name} />
      <ChangePasswordForm hasPassword={Boolean(user.passwordHash)} />
    </div>
  );
}
