import { InvitationStatus, MembershipStatus } from "@/generated/prisma/enums";
import type { CompanyContext } from "@/lib/auth/session";
import { createRole, deleteRole } from "../roles";
import { changeMemberRole, inviteMember } from "../service";
import { createRoleSchema } from "../schemas";

jest.mock("@/lib/db/prisma", () => ({ prisma: {} }));

describe("createRoleSchema", () => {
  it("needs a name and reads an empty 'start from' as nothing", () => {
    expect(createRoleSchema.safeParse({ name: "  ", copyFrom: "" }).success).toBe(false);
    expect(createRoleSchema.parse({ name: " IT support ", copyFrom: "" })).toEqual({ name: "IT support", copyFrom: null });
    expect(createRoleSchema.parse({ name: "X", copyFrom: "role-1" }).copyFrom).toBe("role-1");
  });
});

describe("createRole", () => {
  function ctxWith(source: { permissions: { permissionId: string }[] } | null) {
    const create = jest.fn().mockResolvedValue({ id: "new" });
    const createMany = jest.fn().mockResolvedValue({ count: 0 });
    const findFirst = jest.fn().mockResolvedValue(source);
    const ctx = {
      company: { id: "c1" },
      db: { role: { create, findFirst }, rolePermission: { createMany } },
    } as unknown as CompanyContext;
    return { ctx, create, createMany };
  }

  it("makes a profile with no key, named, and not a system one", async () => {
    const { ctx, create } = ctxWith(null);
    await expect(createRole(ctx, { name: "IT support", copyFrom: null })).resolves.toEqual({ ok: true, id: "new" });
    expect(create).toHaveBeenCalledWith({
      data: { companyId: "c1", key: null, name: "IT support", isSystem: false },
      select: { id: true },
    });
  });

  it("copies the features of the profile it starts from, and ticks nothing otherwise", async () => {
    const withSource = ctxWith({ permissions: [{ permissionId: "p1" }, { permissionId: "p2" }] });
    await createRole(withSource.ctx, { name: "IT support", copyFrom: "sales" });
    expect(withSource.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: "new", permissionId: "p1" },
        { roleId: "new", permissionId: "p2" },
      ],
      skipDuplicates: true,
    });

    const blank = ctxWith(null);
    await createRole(blank.ctx, { name: "Empty", copyFrom: null });
    expect(blank.createMany).not.toHaveBeenCalled();
  });

  it("refuses to copy from a profile that isn't this company's, and creates nothing", async () => {
    const { ctx, create } = ctxWith(null);
    await expect(createRole(ctx, { name: "X", copyFrom: "elsewhere" })).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("deleteRole", () => {
  function ctxWith(role: { key: string | null; memberships: number } | null, pending = 0) {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const invitationDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const count = jest.fn().mockResolvedValue(pending);
    const findFirst = jest.fn().mockResolvedValue(role && { key: role.key, _count: { memberships: role.memberships } });
    const ctx = {
      db: { role: { findFirst, deleteMany }, invitation: { count, deleteMany: invitationDeleteMany } },
    } as unknown as CompanyContext;
    return { ctx, deleteMany, invitationDeleteMany, count };
  }

  it.each([["one the company made", null], ["a standard one", "SALES"]])(
    "deletes %s once nobody holds it, with its answered invitations",
    async (_label, key) => {
    const { ctx, deleteMany, invitationDeleteMany, count } = ctxWith({ key, memberships: 0 });
    await expect(deleteRole(ctx, "r1")).resolves.toEqual({ ok: true });
    expect(count).toHaveBeenCalledWith({ where: { roleId: "r1", status: InvitationStatus.PENDING } });
    expect(invitationDeleteMany).toHaveBeenCalledWith({ where: { roleId: "r1" } });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "r1" } });
    },
  );

  it("never deletes the owner profile", async () => {
    const { ctx, deleteMany } = ctxWith({ key: "OWNER", memberships: 0 });
    await expect(deleteRole(ctx, "r1")).resolves.toEqual({ ok: false, reason: "owner" });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it.each([
    ["somebody holds it", { key: null, memberships: 2 }, 0],
    ["an invitation is waiting for it", { key: "ADMIN", memberships: 0 }, 1],
  ])("refuses while %s, saying how many", async (_label, role, pending) => {
    const { ctx, deleteMany } = ctxWith(role, pending);
    await expect(deleteRole(ctx, "r1")).resolves.toEqual({
      ok: false,
      reason: "in-use",
      members: role.memberships,
      invitations: pending,
    });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("says so for a profile that isn't there", async () => {
    const { ctx } = ctxWith(null);
    await expect(deleteRole(ctx, "r1")).resolves.toEqual({ ok: false, reason: "not-found" });
  });
});

describe("choosing a profile by id", () => {
  it("won't invite into a profile that isn't this company's", async () => {
    const ctx = {
      company: { id: "c1" },
      db: {
        membership: { findFirst: jest.fn().mockResolvedValue(null) },
        role: { findFirst: jest.fn().mockResolvedValue(null) },
        invitation: { upsert: jest.fn() },
      },
    } as unknown as CompanyContext;

    await expect(inviteMember(ctx, { email: "a@b.nz", roleId: "foreign" })).resolves.toEqual({
      ok: false,
      reason: "role-not-found",
    });
    expect(ctx.db.invitation.upsert).not.toHaveBeenCalled();
  });

  it("won't move somebody into a profile that isn't this company's", async () => {
    const update = jest.fn();
    const ctx = {
      user: { id: "actor" },
      db: {
        role: { findFirst: jest.fn().mockResolvedValue(null) },
        membership: { findFirst: jest.fn(), updateMany: update },
      },
    } as unknown as CompanyContext;

    await expect(changeMemberRole(ctx, "u2", "foreign")).resolves.toEqual({ ok: false, reason: "not-found" });
    expect(update).not.toHaveBeenCalled();
  });

  it("moves them, and the rules see the profile's own key", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const ctx = {
      user: { id: "actor" },
      db: {
        role: { findFirst: jest.fn().mockResolvedValue({ id: "custom-1", key: null }) },
        membership: {
          findFirst: jest.fn().mockResolvedValue({
            id: "m1",
            status: MembershipStatus.ACTIVE,
            role: { key: "SALES" },
          }),
          count: jest.fn().mockResolvedValue(2),
          updateMany,
        },
      },
    } as unknown as CompanyContext;

    await expect(changeMemberRole(ctx, "u2", "custom-1")).resolves.toEqual({ ok: true });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "m1" }, data: { roleId: "custom-1" } });
  });
});
