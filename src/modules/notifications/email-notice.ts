import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db/prisma";
import { languageToLocale } from "@/i18n/config";
import { companyUrl } from "@/lib/tenant/host";
import type { Language } from "@/generated/prisma/enums";
import type { CompanyContext } from "@/lib/auth/session";
import { sendNotice } from "./service";

/**
 * The email that goes with a notice already in the bell.
 *
 * Only to the people the bell was actually raised for: `notify` and
 * `notifyEach` already leave out whoever turned that notice off, so the one
 * switch in `/settings/notifications` governs both doorways and this never has
 * to ask again. Each person gets it in their own language, outside the response
 * (`after()`), and never inside a transaction.
 *
 * A notice is a link into the app. The bell keeps a path; an email has no
 * subdomain to be relative to, so the company's own address is put in front.
 */
export type NoticeCompany = { id: string; name: string; slug: string; defaultLanguage: Language };

export type NoticeEmail = {
  userIds: string[];
  /** Under `notifications` in the messages: a `subject`, a `heading` and a `line`. */
  template: string;
  params: Record<string, string>;
  /** Where the button leads, inside the company's subdomain. */
  path: string;
  /** Replies go to the person who did the thing, when there is one. */
  replyTo?: string;
};

/** Queues the emails behind a notice already raised. A no-op when nobody was notified. */
export function emailNotice(ctx: CompanyContext, input: Omit<NoticeEmail, "replyTo">): void {
  if (input.userIds.length === 0) return;
  const company: NoticeCompany = {
    id: ctx.company.id,
    name: ctx.company.name,
    slug: ctx.company.slug,
    defaultLanguage: ctx.company.defaultLanguage,
  };
  after(() => sendNoticeEmails(company, { ...input, replyTo: ctx.user.email }));
}

/** Also what a nightly sweep uses, which has a company and no session. */
export async function sendNoticeEmails(company: NoticeCompany, input: NoticeEmail): Promise<void> {
  const users = await prisma.user.findMany({
    where: { id: { in: input.userIds } },
    select: { email: true, name: true, language: true },
  });

  for (const user of users) {
    try {
      const language = user.language ?? company.defaultLanguage;
      const t = await getTranslations({ locale: languageToLocale(language), namespace: "notifications" });
      await sendNotice({
        to: { email: user.email, name: user.name, language },
        companyName: company.name,
        subject: t(`${input.template}.subject`, input.params),
        heading: t(`${input.template}.heading`, input.params),
        lines: [t(`${input.template}.line`, input.params)],
        actionLabel: t("open"),
        actionUrl: companyUrl(company.slug, input.path),
        footer: { label: t("manage"), url: companyUrl(company.slug, "/settings/notifications") },
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      });
    } catch (error) {
      // One address failing is no reason for the next person to hear nothing.
      console.error("[notice-email]", input.template, error);
    }
  }
}
