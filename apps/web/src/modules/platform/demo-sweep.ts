import { prisma } from "@/lib/db/prisma";
import { MembershipStatus, RoleKey } from "@/generated/prisma/enums";
import { notifyDemoEnded } from "./notify";
import { notifyOwnersDemoEnded, notifyOwnersDemoEnding } from "./owner-notices";
import { DEMO_WARNING_DAYS, isDemoEnding } from "./status";

const DAY = 86_400_000;

/** What both passes need to say who the company is and how its dates read. */
const COMPANY = {
  id: true,
  name: true,
  slug: true,
  defaultLanguage: true,
  formatLocale: true,
  timezone: true,
  demoDays: true,
  demoEndsAt: true,
} as const;

/**
 * Switches off the demos whose days have run out.
 *
 * Part of the nightly sweep and run **before** the rest of it, so a company that
 * ends tonight gets no chasing emails in the same pass. It is the clock's doing,
 * not a person's: the company is left as it was with `isActive` off and
 * `demoEndedAt` set, which is what /admin reads as "Demo ended" rather than
 * "Suspended" — and what activating it again clears.
 *
 * Idempotent through the filter itself, the same way `closeExpiredQuotes` is:
 * the update only matches a demo that is still on and not yet ended, so a retry
 * after a failure costs nothing, running twice closes nothing twice, and two
 * runs at once can't both claim the same company — which is what keeps the
 * emails to one.
 *
 * Resolution is the sweep's: a demo can run up to a day past its end before the
 * night it is noticed. That is the trade for needing no scheduler of its own.
 */
export async function endExpiredDemos(now: Date): Promise<number> {
  const due = await prisma.company.findMany({
    where: { isActive: true, isDemo: true, demoEndedAt: null, demoEndsAt: { lte: now } },
    select: {
      ...COMPANY,
      memberships: {
        where: { role: { key: RoleKey.OWNER }, status: MembershipStatus.ACTIVE },
        take: 1,
        select: { user: { select: { email: true } } },
      },
    },
    take: 200,
  });

  let ended = 0;

  for (const company of due) {
    const { count } = await prisma.company.updateMany({
      where: { id: company.id, isActive: true, isDemo: true, demoEndedAt: null, demoEndsAt: { lte: now } },
      data: { isActive: false, demoEndedAt: now },
    });
    if (count !== 1) continue;

    ended += 1;
    // The platform's admins and the company's owners each hear about it, once.
    await notifyDemoEnded({
      companyName: company.name,
      slug: company.slug,
      days: company.demoDays,
      ownerEmail: company.memberships[0]?.user.email ?? null,
    });
    await notifyOwnersDemoEnded(company, { days: company.demoDays, endsAt: company.demoEndsAt ?? now });
  }

  return ended;
}

/**
 * Tells the owners of a demo that it ends in a few days.
 *
 * This is the email that does the work: it reaches somebody who can still act,
 * before the access goes. Once per demo through `demoWarnedAt`, claimed in the
 * same single update that makes it safe to retry, and cleared when the demo's
 * days change so an extended demo is warned again before its new end.
 */
export async function warnEndingDemos(now: Date): Promise<number> {
  const horizon = new Date(now.getTime() + DEMO_WARNING_DAYS * DAY);

  const due = await prisma.company.findMany({
    where: {
      isActive: true,
      isDemo: true,
      demoEndedAt: null,
      demoWarnedAt: null,
      demoDays: { gt: DEMO_WARNING_DAYS },
      demoEndsAt: { gt: now, lte: horizon },
    },
    select: COMPANY,
    take: 200,
  });

  let warned = 0;

  for (const company of due) {
    // The query above already narrows to this; `isDemoEnding` is the one tested
    // word on what "about to end" means, the sibling of `isDemoExpired`.
    if (
      !isDemoEnding(
        { isActive: true, approvedAt: null, isDemo: true, demoEndsAt: company.demoEndsAt, demoEndedAt: null, demoDays: company.demoDays, demoWarnedAt: null },
        now,
      )
    ) {
      continue;
    }

    const { count } = await prisma.company.updateMany({
      where: { id: company.id, isActive: true, isDemo: true, demoEndedAt: null, demoWarnedAt: null },
      data: { demoWarnedAt: now },
    });
    if (count !== 1) continue;

    warned += 1;
    await notifyOwnersDemoEnding(company, { days: company.demoDays, endsAt: company.demoEndsAt ?? now });
  }

  return warned;
}
