import { isRoleNameTaken, roleDisplayName } from "@/lib/auth/role-name";
import { RoleKey } from "@/generated/prisma/enums";
import { renameRole } from "../roles";
import { ROLE_NAME_MAX, roleNameSchema } from "../schemas";
import type { CompanyContext } from "@/lib/auth/session";

const standard = (key: string) => `standard ${key}`;

describe("roleNameSchema", () => {
  it("trims, and treats empty as 'use the standard name'", () => {
    expect(roleNameSchema.parse({ name: "  Tech lead  " }).name).toBe("Tech lead");
    expect(roleNameSchema.parse({ name: "   " }).name).toBeNull();
  });

  it("refuses a name longer than a label can hold, with a translatable key", () => {
    const result = roleNameSchema.safeParse({ name: "x".repeat(ROLE_NAME_MAX + 1) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(`validation.maxChars|max=${ROLE_NAME_MAX}`);
  });
});

describe("what a renamed profile is called", () => {
  it("shows the company's name when there is one, and the standard one when not", () => {
    expect(roleDisplayName({ key: RoleKey.SALES, name: "Account executive" }, standard)).toBe("Account executive");
    expect(roleDisplayName({ key: RoleKey.SALES, name: null }, standard)).toBe("standard SALES.name");
  });
});

describe("renameRole", () => {
  function ctxWith(role: { isSystem: boolean } | null) {
    const findFirst = jest.fn().mockResolvedValue(role);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    return { ctx: { db: { role: { findFirst, updateMany } } } as unknown as CompanyContext, updateMany };
  }

  it("writes only the name, so the key that makes OWNER special is never touched", async () => {
    const { ctx, updateMany } = ctxWith({ isSystem: true });
    await expect(renameRole(ctx, "r1", "Director")).resolves.toEqual({ ok: true });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "r1" }, data: { name: "Director" } });
  });

  it("takes a standard profile back to its standard name with null", async () => {
    const { ctx, updateMany } = ctxWith({ isSystem: true });
    await renameRole(ctx, "r1", null);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "r1" }, data: { name: null } });
  });

  it("won't leave a profile the company made with no name", async () => {
    const { ctx, updateMany } = ctxWith({ isSystem: false });
    await expect(renameRole(ctx, "r1", null)).resolves.toEqual({ ok: false, reason: "name-required" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("says so when the profile isn't in this company", async () => {
    const { ctx } = ctxWith(null);
    await expect(renameRole(ctx, "other", "X")).resolves.toEqual({ ok: false, reason: "not-found" });
  });
});

describe("isRoleNameTaken", () => {
  const roles = [
    { id: "a", key: RoleKey.ADMIN, name: null },
    { id: "b", key: RoleKey.SALES, name: "Account executive" },
    { id: "c", key: null, name: "IT support" },
  ];

  it("compares what is shown, standard translated names included, ignoring case and space", () => {
    expect(isRoleNameTaken(roles, " it SUPPORT ", standard)).toBe(true);
    expect(isRoleNameTaken(roles, "account executive", standard)).toBe(true);
    expect(isRoleNameTaken(roles, "standard admin.name", standard)).toBe(true);
    expect(isRoleNameTaken(roles, "Field tech", standard)).toBe(false);
  });

  it("lets a profile keep its own name", () => {
    expect(isRoleNameTaken(roles, "IT support", standard, "c")).toBe(false);
  });
});
