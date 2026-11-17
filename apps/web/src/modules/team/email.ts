import { getTranslations } from "next-intl/server";
import { defaultFrom, getResend } from "@/lib/email/resend";
import { escapeHtml } from "@/lib/html";
import { languageToLocale } from "@/i18n/config";
import type { Language } from "@/generated/prisma/enums";
import { INVITATION_DAYS } from "./invitations";

/**
 * The invitation, in the company's default language.
 *
 * Not the sender's and not the recipient's: the person being invited has no
 * account yet, so there is no preference to follow, and the company's own
 * default is the closest thing to a right answer.
 */
export async function sendInvitationEmail(input: {
  to: string;
  companyName: string;
  inviterName: string;
  roleName: string;
  url: string;
  language: Language;
}): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const locale = languageToLocale(input.language);
  const t = await getTranslations({ locale, namespace: "team.email" });

  const lines = [
    t("intro", { inviter: input.inviterName, company: input.companyName, role: input.roleName }),
    t("expiry", { days: INVITATION_DAYS }),
  ]
    .map((line) => `<p style="margin:0 0 10px;font-size:14px">${escapeHtml(line)}</p>`)
    .join("");

  const { error } = await resend.emails.send({
    from: defaultFrom(input.companyName),
    to: input.to,
    subject: t("subject", { company: input.companyName }),
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
  <h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(t("heading", { company: input.companyName }))}</h1>
  ${lines}
  <p style="margin:20px 0 0"><a href="${escapeHtml(input.url)}" style="font-size:14px">${escapeHtml(t("action"))}</a></p>
</div>`,
  });

  return !error;
}
