import type { CompanyContext } from "@/lib/auth/session";
import { emailNotice, sendNoticeEmails } from "@/modules/notifications/email-notice";
import type { NoticeCompany, NoticeEmail } from "@/modules/notifications/email-notice";

/**
 * The email that goes with a job's notice: the same pipeline as every other
 * notice (`notifications/email-notice.ts`), with its wording under
 * `notifications.job`.
 */
export type JobEmailTemplate =
  | "added"
  | "todoAssigned"
  | "todoCompleted"
  | "todoDue"
  | "mention"
  | "post"
  | "comment"
  | "event"
  | "finished";

export type JobEmail = Omit<NoticeEmail, "template"> & { template: JobEmailTemplate };

/** Queues the emails behind a notice already raised. A no-op when nobody was notified. */
export function emailJobNotice(ctx: CompanyContext, input: Omit<JobEmail, "replyTo">): void {
  emailNotice(ctx, { ...input, template: `job.${input.template}` });
}

/** Also what the nightly sweep uses, which has a company and no session. */
export async function sendJobEmails(company: NoticeCompany, input: JobEmail): Promise<void> {
  await sendNoticeEmails(company, { ...input, template: `job.${input.template}` });
}
