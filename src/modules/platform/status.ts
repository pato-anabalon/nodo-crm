/**
 * What state a company is in, as /admin shows it.
 *
 * `Company.isActive` is the one switch the app reads; everything here is a
 * *reason* for it, worked out from the fields beside it so the screens, the
 * actions and the sweep all agree on a word without each deciding it again.
 * Pure on purpose — it needs no database to check.
 */

const DAY = 86_400_000;

export const DEMO_DAYS_DEFAULT = 14;
export const DEMO_DAYS_MAX = 365;

export type CompanyAccess = {
  isActive: boolean;
  approvedAt: Date | null;
  isDemo: boolean;
  demoEndsAt: Date | null;
  demoEndedAt: Date | null;
};

export type CompanyStatus =
  /** Signed up and never switched on. */
  | { kind: "pending" }
  /** On, with no time limit. */
  | { kind: "customer" }
  /** On for a set number of days. `daysLeft` is 0 on the last day. */
  | { kind: "demo"; endsAt: Date; daysLeft: number }
  /** Ran out and was switched off by the sweep. */
  | { kind: "demoEnded"; endedAt: Date | null }
  /** Switched off by somebody, after having been on. */
  | { kind: "suspended" };

export type StatusKind = CompanyStatus["kind"];

export function companyStatus(company: CompanyAccess, now: Date): CompanyStatus {
  if (company.isActive) {
    if (company.isDemo && company.demoEndsAt) {
      const daysLeft = Math.max(0, Math.ceil((company.demoEndsAt.getTime() - now.getTime()) / DAY));
      return { kind: "demo", endsAt: company.demoEndsAt, daysLeft };
    }
    return { kind: "customer" };
  }

  // The sweep's own mark wins over "never approved": a demo that ran out was
  // approved, and says so by having ended.
  if (company.demoEndedAt) return { kind: "demoEnded", endedAt: company.demoEndedAt };
  if (!company.approvedAt) return { kind: "pending" };
  return { kind: "suspended" };
}

/** When a demo that started at `startedAt` and lasts `days` runs out. */
export function demoEndsAt(startedAt: Date, days: number): Date {
  return new Date(startedAt.getTime() + days * DAY);
}

export function isValidDemoDays(days: unknown): days is number {
  return typeof days === "number" && Number.isInteger(days) && days >= 1 && days <= DEMO_DAYS_MAX;
}

/**
 * Whether the sweep should switch this company off: a demo that is on, has not
 * been ended already, and whose days have run out. Checking `demoEndedAt` as
 * well as `isActive` is what makes it safe to ask twice.
 */
export function isDemoExpired(company: CompanyAccess, now: Date): boolean {
  return (
    company.isActive &&
    company.isDemo &&
    company.demoEndedAt === null &&
    company.demoEndsAt !== null &&
    company.demoEndsAt.getTime() <= now.getTime()
  );
}

/** How far ahead of its end the owners are told. */
export const DEMO_WARNING_DAYS = 3;

/**
 * Whether the owners should be told tonight that the demo is about to end.
 *
 * Not for a demo no longer than the window itself: warning somebody the night
 * after they start that it ends in two days says nothing the dialog didn't. And
 * not twice — `demoWarnedAt` is what the sweep set the first time.
 */
export function isDemoEnding(
  company: CompanyAccess & { demoDays: number | null; demoWarnedAt: Date | null },
  now: Date,
): boolean {
  if (!company.isActive || !company.isDemo || company.demoEndedAt !== null) return false;
  if (company.demoWarnedAt !== null || company.demoEndsAt === null) return false;
  if (company.demoDays === null || company.demoDays <= DEMO_WARNING_DAYS) return false;

  const left = company.demoEndsAt.getTime() - now.getTime();
  return left > 0 && left <= DEMO_WARNING_DAYS * DAY;
}

/** What /admin lists first: the ones waiting on somebody, then the ones that lapsed. */
export const STATUS_ORDER: Record<StatusKind, number> = {
  pending: 0,
  demoEnded: 1,
  suspended: 2,
  demo: 3,
  customer: 4,
};
