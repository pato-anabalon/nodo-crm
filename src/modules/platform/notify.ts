import { getTranslations } from "next-intl/server";
import { platformAdminAddresses } from "@/lib/auth/platform-admin";
import { ROOT_DOMAIN, rootProtocol } from "@/lib/tenant/host";
import { sendNotice } from "@/modules/notifications/service";

/**
 * Tells whoever operates the platform that a company signed up and is waiting
 * to be switched on. It's for the operators, not for a company's team, so it
 * is always in English whatever language the visitor was reading.
 *
 * Best effort: the company already exists, so a failed email must not turn the
 * sign-up into an error. It still shows in /admin, newest first.
 */
export async function notifyCompanyRegistered(input: {
  companyName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
}): Promise<void> {
  const to = platformAdminAddresses();
  if (to.length === 0) return;

  const t = await getTranslations({ locale: "en-GB", namespace: "platform.registeredNotice" });

  for (const email of to) {
    try {
      await sendNotice({
        to: { email, name: null, language: "EN_GB" },
        companyName: "Nodo CRM",
        subject: t("subject", { company: input.companyName }),
        heading: t("heading"),
        lines: [
          t("company", { company: input.companyName, slug: input.slug }),
          t("owner", { name: input.ownerName, email: input.ownerEmail }),
          t("body"),
        ],
        actionLabel: t("action"),
        actionUrl: `${rootProtocol()}://${ROOT_DOMAIN}/admin`,
      });
    } catch (error) {
      console.error("Could not email the platform admin about a new company", error);
    }
  }
}
