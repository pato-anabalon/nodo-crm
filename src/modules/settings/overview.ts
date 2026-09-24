import type { CompanyContext } from "@/lib/auth/session";
import { MembershipStatus } from "@/generated/prisma/enums";

/**
 * What each settings card has inside it.
 *
 * The reason the index is cards rather than a list: a card has room for a line
 * of state, and that line is what turns a menu into something you can read. A
 * new company has most of these empty, and seeing which without opening nine
 * screens is the whole point.
 *
 * One round trip. These are all `count()` on indexed columns and the page is
 * not one somebody sits on, but ten sequential queries to open a menu would
 * still be ten.
 */
export type SettingsOverview = {
  companyName: string;
  hasLogo: boolean;
  team: number;
  profiles: number;
  catalogue: number;
  quoteTemplates: number;
  documents: number;
  /** How many of the customer emails the company has worded itself. */
  emailTemplates: number;
  reviews: number;
  ingestKeys: number;
  /** Notices this person turned off. Zero means they get everything. */
  mutedNotices: number;
};

export async function settingsOverview(ctx: CompanyContext): Promise<SettingsOverview> {
  const [
    team,
    profiles,
    catalogue,
    quoteTemplates,
    documents,
    emailTemplates,
    reviews,
    ingestKeys,
    mutedNotices,
  ] = await Promise.all([
    ctx.db.membership.count({ where: { status: MembershipStatus.ACTIVE } }),
    ctx.db.role.count(),
    // Retired lines drop out of the picker, so they shouldn't be counted as
    // something the company has to quote with.
    ctx.db.catalogueItem.count({ where: { active: true } }),
    ctx.db.quoteTemplate.count(),
    ctx.db.companyDocument.count(),
    ctx.db.emailTemplate.count(),
    ctx.db.companyReview.count(),
    // A revoked key is one somebody deliberately closed; counting it would say
    // the form is connected when it isn't.
    ctx.db.ingestKey.count({ where: { revokedAt: null } }),
    // `NotificationPreference` stores only the opt-outs, so this is exactly the
    // number of notices this person turned off.
    ctx.db.notificationPreference.count({ where: { userId: ctx.user.id, enabled: false } }),
  ]);

  return {
    companyName: ctx.company.name,
    hasLogo: Boolean(ctx.company.logoUrl),
    team,
    profiles,
    catalogue,
    quoteTemplates,
    documents,
    emailTemplates,
    reviews,
    ingestKeys,
    mutedNotices,
  };
}
