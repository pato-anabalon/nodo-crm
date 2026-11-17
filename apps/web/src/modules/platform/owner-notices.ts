import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { languageToLocale } from "@/i18n/config";
import { Language, MembershipStatus, RoleKey } from "@/generated/prisma/enums";
import { ROOT_DOMAIN, rootProtocol } from "@/lib/tenant/host";
import { sendNotice } from "@/modules/notifications/service";
import { platformContactEmail } from "./contact";

/**
 * What a demo's owners are told, as Nodo and not as their company.
 *
 * Unlike the emails a company sends its customers, these have no template
 * behind them and no screen to edit one: the wording is the platform's own, in
 * `messages`, translated and changed in code like any other text. They go to the
 * company's active owners, each in their own language, and are not a setting —
 * they are about the owner's access, not a preference about what they receive.
 *
 * The invitation is to get in touch and take the platform up, not to ask for
 * more time. When there are plans and online payment, this is where the action
 * becomes "choose a plan".
 */

export type DemoCompany = {
  id: string;
  name: string;
  defaultLanguage: Language;
  formatLocale: string;
  timezone: string;
};

type Kind = "ended" | "ending";

async function activeOwners(companyId: string) {
  const memberships = await prisma.membership.findMany({
    where: { companyId, role: { key: RoleKey.OWNER }, status: MembershipStatus.ACTIVE },
    select: { user: { select: { email: true, name: true, language: true } } },
    take: 10,
  });
  return memberships.map((membership) => membership.user);
}

async function tell(kind: Kind, company: DemoCompany, demo: { days: number | null; endsAt: Date }): Promise<void> {
  const contact = platformContactEmail();
  // With no contact address configured there is nothing to write to, so the
  // button goes to the public site rather than to a mailto that leads nowhere.
  const actionUrl = contact ? `mailto:${contact}` : `${rootProtocol()}://${ROOT_DOMAIN}`;
  const date = new Intl.DateTimeFormat(company.formatLocale, { dateStyle: "long", timeZone: company.timezone }).format(
    demo.endsAt,
  );

  for (const owner of await activeOwners(company.id)) {
    const language = owner.language ?? company.defaultLanguage;
    try {
      const t = await getTranslations({ locale: languageToLocale(language), namespace: "platform.ownerDemo" });
      const values = { company: company.name, days: demo.days ?? 0, date };

      await sendNotice({
        to: { email: owner.email, name: owner.name, language },
        companyName: "Nodo CRM",
        subject: t(`${kind}.subject`, values),
        heading: t(`${kind}.heading`, values),
        lines: [t(`${kind}.line1`, values), t(`${kind}.line2`, values)],
        actionLabel: t("action"),
        actionUrl,
        replyTo: contact ?? undefined,
      });
    } catch (error) {
      // The company is already off or already warned: a failed email changes
      // nothing but whether this owner hears about it tonight.
      console.error("Could not email a company owner about their demo", error);
    }
  }
}

/** The demo ran out and the company was switched off. */
export function notifyOwnersDemoEnded(company: DemoCompany, demo: { days: number | null; endsAt: Date }) {
  return tell("ended", company, demo);
}

/** The demo is a few days from ending. */
export function notifyOwnersDemoEnding(company: DemoCompany, demo: { days: number | null; endsAt: Date }) {
  return tell("ending", company, demo);
}
