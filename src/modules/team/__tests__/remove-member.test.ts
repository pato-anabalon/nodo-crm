// The service opens a database client on import; nothing here touches it.
jest.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import type { CompanyContext } from "@/lib/auth/session";
import { MembershipStatus, RoleKey } from "@/generated/prisma/enums";
import { removeMember } from "../service";

/** A tenant client that records the order things were deleted in. */
function fakeCtx(calls: string[]) {
  const del = (model: string) => ({
    deleteMany: jest.fn(async (args: unknown) => {
      calls.push(`${model}:${JSON.stringify(args)}`);
      return { count: 1 };
    }),
  });
  return {
    user: { id: "me" },
    db: {
      membership: {
        findFirst: jest.fn(async () => ({
          id: "m2",
          status: MembershipStatus.ACTIVE,
          role: { key: RoleKey.WORKER },
        })),
        count: jest.fn(async () => 1),
        ...del("membership"),
      },
      jobMember: del("jobMember"),
      jobTodoAssignee: del("jobTodoAssignee"),
      jobEventParticipant: del("jobEventParticipant"),
    },
  } as unknown as CompanyContext;
}

describe("removing a member", () => {
  it("takes them off the jobs, their to-dos and their events as well as off the company", async () => {
    const calls: string[] = [];
    const result = await removeMember(fakeCtx(calls), "u2");

    expect(result).toEqual({ ok: true });
    expect(calls.map((call) => call.split(":")[0]).sort()).toEqual(
      ["jobEventParticipant", "jobMember", "jobTodoAssignee", "membership"].sort(),
    );
    for (const call of calls.filter((c) => !c.startsWith("membership"))) {
      expect(call).toContain('"userId":"u2"');
    }
  });

  it("deletes the membership last, so a failure part-way leaves them removable again", async () => {
    const calls: string[] = [];
    await removeMember(fakeCtx(calls), "u2");
    expect(calls.at(-1)?.startsWith("membership")).toBe(true);
  });

  it("touches nothing when the rules refuse", async () => {
    const calls: string[] = [];
    const result = await removeMember(fakeCtx(calls), "me");
    expect(result.ok).toBe(false);
    expect(calls).toEqual([]);
  });
});
