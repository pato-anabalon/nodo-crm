/** @jest-environment node */
import type { CompanyContext } from "@/lib/auth/session";
import { addScopeItem, deleteScopeItem, scopeChanged, scopeItemSchema, updateScopeItem } from "../scope-edits";

/**
 * The scope of work changed on the job. Pinned: no change lands without its
 * line in the history and on the timeline, what the history keeps is what the
 * line said before, and a line on another job is never reached.
 */

jest.mock("@/lib/db/prisma", () => {
  const tx = {
    jobScopeItem: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    jobScopeChange: { create: jest.fn() },
    jobActivity: { create: jest.fn() },
  };
  return {
    prisma: {
      ...tx,
      $transaction: jest.fn(async (arg: unknown) => (typeof arg === "function" ? arg(tx) : Promise.all(arg as unknown[]))),
    },
  };
});

const { prisma } = jest.requireMock<{
  prisma: {
    jobScopeItem: Record<"create" | "update" | "delete", jest.Mock>;
    jobScopeChange: Record<"create", jest.Mock>;
    jobActivity: Record<"create", jest.Mock>;
  };
}>("@/lib/db/prisma");

function context(found: { title: string; body: string | null } | null = { title: "Skim coat", body: "<p>Two coats</p>" }) {
  const db = {
    jobScopeItem: {
      findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string } }) =>
        Promise.resolve(where.id === undefined ? { position: 2 } : found),
      ),
    },
  };
  const ctx = { user: { id: "ana" }, company: { id: "c1" }, db } as unknown as CompanyContext;
  return { ctx, db };
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.jobScopeItem.create.mockResolvedValue({ id: "new" });
});

it("adds a line at the end, with its history and its timeline line", async () => {
  const { ctx } = context();
  await expect(addScopeItem(ctx, "j1", { title: "Sand", body: null })).resolves.toBe("new");
  expect(prisma.jobScopeItem.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ companyId: "c1", jobId: "j1", position: 3, editedById: "ana" }) }),
  );
  expect(prisma.jobScopeChange.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ kind: "ADDED", scopeItemId: "new", after: { title: "Sand", body: null }, authorId: "ana" }),
  });
  expect(prisma.jobActivity.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ type: "SCOPE_CHANGED", params: { action: "added", title: "Sand", itemId: "new" } }),
  });
});

it("keeps what a line said before it was edited", async () => {
  const { ctx, db } = context();
  await expect(updateScopeItem(ctx, "j1", "s1", { title: "Skim coat", body: "<p>Three coats</p>" })).resolves.toBe(true);
  expect(db.jobScopeItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "s1", jobId: "j1" } }));
  expect(prisma.jobScopeChange.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      kind: "EDITED",
      before: { title: "Skim coat", body: "<p>Two coats</p>" },
      after: { title: "Skim coat", body: "<p>Three coats</p>" },
    }),
  });
});

it("writes nothing when nothing changed, or the line isn't on this job", async () => {
  await expect(updateScopeItem(context().ctx, "j1", "s1", { title: "Skim coat", body: "<p>Two coats</p>" })).resolves.toBe(false);
  await expect(updateScopeItem(context(null).ctx, "j1", "s9", { title: "x", body: null })).resolves.toBe(false);
  await expect(deleteScopeItem(context(null).ctx, "j1", "s9")).resolves.toBe(false);
  expect(prisma.jobScopeChange.create).not.toHaveBeenCalled();
});

it("deletes a line, keeping its history with what it said", async () => {
  await expect(deleteScopeItem(context().ctx, "j1", "s1")).resolves.toBe(true);
  expect(prisma.jobScopeChange.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ kind: "DELETED", scopeItemId: "s1", before: { title: "Skim coat", body: "<p>Two coats</p>" } }),
  });
  expect(prisma.jobScopeItem.delete).toHaveBeenCalledWith({ where: { id: "s1", companyId: "c1" } });
});

it("takes an empty description as none, and sanitises what it keeps", () => {
  expect(scopeItemSchema.parse({ title: " Sand ", body: "<p></p>" })).toEqual({ title: "Sand", body: null });
  expect(scopeItemSchema.parse({ title: "Sand", body: '<p onclick="x()">Ok</p><script>x()</script>' }).body).toBe("<p>Ok</p>");
  expect(scopeChanged({ title: "a", body: null }, { title: "a", body: null })).toBe(false);
});
