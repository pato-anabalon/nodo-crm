const createTask = jest.fn(async () => ({}));
const listCompanyMembers = jest.fn(async () => [{ userId: "ana", name: "Ana" }]);
jest.mock("@/modules/tasks/service", () => ({ createTask: (...a: unknown[]) => createTask(...(a as [])) }));
jest.mock("@/modules/team/service", () => ({ listCompanyMembers: () => listCompanyMembers() }));
jest.mock("@/lib/db/prisma", () => ({ prisma: {} }));
jest.mock("@/modules/notifications/inbox", () => ({ notify: jest.fn() }));

import type { CompanyContext } from "@/lib/auth/session";
import { scheduleLeadAction } from "../schedule";

function ctxWith({ canAssign = false, leadFound = true } = {}) {
  const activities: unknown[] = [];
  const ctx = {
    user: { id: "me" },
    company: { id: "c1", timezone: "Pacific/Auckland" },
    permissions: new Set(["leads.update", ...(canAssign ? ["leads.assign", "leads.read.all"] : ["leads.read.all"])]),
    db: {
      lead: { findFirst: async () => (leadFound ? { id: "l1" } : null) },
      activity: { create: async (arg: unknown) => activities.push(arg) },
    },
  } as unknown as CompanyContext;
  return { ctx, activities };
}

const values = { title: "Call back", day: "2026-10-29", time: "11:00", assigneeId: null };

beforeEach(() => jest.clearAllMocks());

describe("scheduleLeadAction", () => {
  it("creates a task on the lead at the company's wall-clock time, for the author", async () => {
    const { ctx, activities } = ctxWith();
    expect(await scheduleLeadAction(ctx, "l1", values)).toBe("ok");

    const task = (createTask.mock.calls[0] as unknown[])[1] as { dueAt: Date; leadId: string; assigneeId: string };
    // 11:00 in Auckland (NZDT, UTC+13) on 29 October is 22:00 UTC the day before.
    expect(task.dueAt.toISOString()).toBe("2026-10-28T22:00:00.000Z");
    expect(task.leadId).toBe("l1");
    expect(task.assigneeId).toBe("me");
    expect(activities).toHaveLength(1);
  });

  it("does nothing for a lead the person can't open", async () => {
    const { ctx } = ctxWith({ leadFound: false });
    expect(await scheduleLeadAction(ctx, "l1", values)).toBe("notFound");
    expect(createTask).not.toHaveBeenCalled();
  });

  it("refuses to hand it to someone else without leads.assign", async () => {
    const { ctx } = ctxWith({ canAssign: false });
    expect(await scheduleLeadAction(ctx, "l1", { ...values, assigneeId: "ana" })).toBe("badAssignee");
    expect(createTask).not.toHaveBeenCalled();
  });

  it("hands it to a team member with leads.assign, and refuses a stranger", async () => {
    const { ctx } = ctxWith({ canAssign: true });
    expect(await scheduleLeadAction(ctx, "l1", { ...values, assigneeId: "ana" })).toBe("ok");
    expect(await scheduleLeadAction(ctx, "l1", { ...values, assigneeId: "stranger" })).toBe("badAssignee");
  });
});
