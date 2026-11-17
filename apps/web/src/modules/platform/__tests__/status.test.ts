import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  companyStatus,
  DEMO_WARNING_DAYS,
  demoEndsAt,
  isDemoEnding,
  isDemoExpired,
  isValidDemoDays,
  type CompanyAccess,
} from "../status";

const NOW = new Date("2026-10-21T08:00:00Z");
const DAY = 86_400_000;
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * DAY);

const base: CompanyAccess = {
  isActive: true,
  approvedAt: new Date("2026-09-01T00:00:00Z"),
  isDemo: false,
  demoEndsAt: null,
  demoEndedAt: null,
};

describe("companyStatus", () => {
  it("reads a company that signed up and was never switched on as pending", () => {
    expect(companyStatus({ ...base, isActive: false, approvedAt: null }, NOW)).toEqual({ kind: "pending" });
  });

  it("reads one that was on and was turned off as suspended, not pending", () => {
    expect(companyStatus({ ...base, isActive: false }, NOW)).toEqual({ kind: "suspended" });
  });

  it("reads a company that is on with no demo as a customer", () => {
    expect(companyStatus(base, NOW)).toEqual({ kind: "customer" });
  });

  it("counts the days left in a running demo, rounding up so the last day still reads as a day", () => {
    const status = companyStatus({ ...base, isDemo: true, demoEndsAt: daysFromNow(9.2) }, NOW);
    expect(status).toMatchObject({ kind: "demo", daysLeft: 10 });
  });

  it("says 0 days left, never a negative one, for a demo the sweep hasn't got to yet", () => {
    const status = companyStatus({ ...base, isDemo: true, demoEndsAt: daysFromNow(-0.5) }, NOW);
    expect(status).toMatchObject({ kind: "demo", daysLeft: 0 });
  });

  it("tells a demo that ran out from a company somebody suspended", () => {
    const ended = companyStatus({ ...base, isActive: false, isDemo: true, demoEndsAt: daysFromNow(-1), demoEndedAt: daysFromNow(-1) }, NOW);
    expect(ended.kind).toBe("demoEnded");

    // Suspended in the middle of a demo: off, but nothing ended it.
    const suspended = companyStatus({ ...base, isActive: false, isDemo: true, demoEndsAt: daysFromNow(5) }, NOW);
    expect(suspended.kind).toBe("suspended");
  });

  it("does not let a stale ended-mark hide a company that is on again", () => {
    expect(companyStatus({ ...base, demoEndedAt: daysFromNow(-3) }, NOW).kind).toBe("customer");
  });
});

describe("isDemoExpired", () => {
  const demo: CompanyAccess = { ...base, isDemo: true, demoEndsAt: daysFromNow(-1) };

  it("is true for a demo that is on and past its end", () => {
    expect(isDemoExpired(demo, NOW)).toBe(true);
  });

  it("is true at the exact instant it ends", () => {
    expect(isDemoExpired({ ...demo, demoEndsAt: NOW }, NOW)).toBe(true);
  });

  it("is false while days remain", () => {
    expect(isDemoExpired({ ...demo, demoEndsAt: daysFromNow(1) }, NOW)).toBe(false);
  });

  it("is false for a customer, however old", () => {
    expect(isDemoExpired({ ...base, demoEndsAt: daysFromNow(-100) }, NOW)).toBe(false);
  });

  it("is false once it has already been ended, so asking twice does nothing", () => {
    expect(isDemoExpired({ ...demo, demoEndedAt: NOW }, NOW)).toBe(false);
  });

  it("is false for a company that is off: suspending one doesn't make the sweep close it again", () => {
    expect(isDemoExpired({ ...demo, isActive: false }, NOW)).toBe(false);
  });
});

describe("isDemoEnding", () => {
  const demo = {
    ...base,
    isDemo: true,
    demoDays: 14,
    demoEndsAt: daysFromNow(2),
    demoWarnedAt: null as Date | null,
  };

  it("is true once the end is inside the warning window", () => {
    expect(isDemoEnding(demo, NOW)).toBe(true);
    expect(isDemoEnding({ ...demo, demoEndsAt: daysFromNow(DEMO_WARNING_DAYS) }, NOW)).toBe(true);
  });

  it("is false while the end is further off than the window", () => {
    expect(isDemoEnding({ ...demo, demoEndsAt: daysFromNow(DEMO_WARNING_DAYS + 0.5) }, NOW)).toBe(false);
  });

  it("is false once it has already ended or run out: that is the other notice", () => {
    expect(isDemoEnding({ ...demo, demoEndsAt: daysFromNow(-1) }, NOW)).toBe(false);
    expect(isDemoEnding({ ...demo, demoEndedAt: NOW }, NOW)).toBe(false);
  });

  it("is false when the owners were already told, so it is one notice and not a nightly one", () => {
    expect(isDemoEnding({ ...demo, demoWarnedAt: daysFromNow(-1) }, NOW)).toBe(false);
  });

  it("is false for a demo no longer than the window: the night after it starts it would say nothing new", () => {
    expect(isDemoEnding({ ...demo, demoDays: DEMO_WARNING_DAYS }, NOW)).toBe(false);
    expect(isDemoEnding({ ...demo, demoDays: DEMO_WARNING_DAYS + 1 }, NOW)).toBe(true);
  });

  it("is false for a customer or a company that is off", () => {
    expect(isDemoEnding({ ...demo, isDemo: false }, NOW)).toBe(false);
    expect(isDemoEnding({ ...demo, isActive: false }, NOW)).toBe(false);
  });
});

describe("demo days", () => {
  it("ends a demo that many whole days after it started", () => {
    expect(demoEndsAt(NOW, 14).getTime()).toBe(NOW.getTime() + 14 * DAY);
  });

  it.each([1, 14, 365])("accepts %i", (days) => expect(isValidDemoDays(days)).toBe(true));
  it.each([0, -3, 366, 1.5, NaN, "14", null, undefined])("refuses %p", (days) => expect(isValidDemoDays(days)).toBe(false));
});

/**
 * Demos only end if the nightly sweep asks. It needs a database, so this reads
 * the source: it is cheap, and it is the line whose removal would leave every
 * demo running forever with nothing failing.
 */
describe("the nightly sweep", () => {
  it("ends expired demos, and does so before reading the companies it will chase", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/notifications/sweep.ts"), "utf8");
    const ends = source.indexOf("endExpiredDemos(now)");
    const reads = source.indexOf("prisma.company.findMany");

    expect(ends).toBeGreaterThan(-1);
    expect(ends).toBeLessThan(reads);
  });

  it("warns the owners of a demo that is about to end, also before reading the companies it will chase", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/notifications/sweep.ts"), "utf8");

    expect(source.indexOf("warnEndingDemos(now)")).toBeGreaterThan(-1);
    expect(source.indexOf("warnEndingDemos(now)")).toBeLessThan(source.indexOf("prisma.company.findMany"));
  });

  it("claims the warning in the update that makes it safe to retry, and only for one not yet warned", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/platform/demo-sweep.ts"), "utf8");
    const warn = source.slice(source.indexOf("export async function warnEndingDemos"));
    const update = warn.slice(warn.indexOf("updateMany"));

    expect(update).toContain("demoWarnedAt: null");
    expect(update).toContain("data: { demoWarnedAt: now }");
  });

  it("clears the warning whenever a demo's days change, so an extended demo is warned again", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/platform/service.ts"), "utf8");

    // Starting a demo, changing its days, and ending it each write it back to null.
    expect(source.match(/demoWarnedAt: null/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("only matches a demo that is still on and not yet ended, so a retry changes nothing", () => {
    const source = readFileSync(join(process.cwd(), "src/modules/platform/demo-sweep.ts"), "utf8");
    const update = source.slice(source.indexOf("updateMany"));

    expect(update).toContain("isActive: true");
    expect(update).toContain("demoEndedAt: null");
    expect(update).toContain("demoEndsAt: { lte: now }");
  });
});
