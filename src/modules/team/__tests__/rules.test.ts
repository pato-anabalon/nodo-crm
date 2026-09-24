import { MembershipStatus, RoleKey } from "@/generated/prisma/enums";
import { isRoleEditable, refuseMemberChange, type MemberSnapshot } from "../rules";

const ACTOR = "user-actor";
const member = (over: Partial<MemberSnapshot> = {}): MemberSnapshot => ({
  userId: "user-other",
  roleKey: RoleKey.SALES,
  status: MembershipStatus.ACTIVE,
  ...over,
});

describe("refuseMemberChange — your own membership", () => {
  it.each([
    ["remove", { kind: "remove" } as const],
    ["suspend", { kind: "suspend" } as const],
    ["a role change", { kind: "role", to: RoleKey.VIEWER } as const],
  ])("refuses %s on yourself", (_label, change) => {
    // Demoting yourself by mistake takes away the screen you'd undo it from.
    expect(refuseMemberChange(ACTOR, member({ userId: ACTOR }), change, 3)).toBe("self");
  });

  it("lets you change somebody else", () => {
    expect(refuseMemberChange(ACTOR, member(), { kind: "remove" }, 3)).toBeNull();
  });
});

describe("refuseMemberChange — the last owner", () => {
  const owner = member({ roleKey: RoleKey.OWNER });

  it.each([
    ["removing", { kind: "remove" } as const],
    ["suspending", { kind: "suspend" } as const],
    ["demoting", { kind: "role", to: RoleKey.ADMIN } as const],
  ])("refuses %s the only active owner", (_label, change) => {
    expect(refuseMemberChange(ACTOR, owner, change, 1)).toBe("last-owner");
  });

  it.each([
    ["removing", { kind: "remove" } as const],
    ["demoting", { kind: "role", to: RoleKey.ADMIN } as const],
  ])("allows %s an owner when another one is active", (_label, change) => {
    expect(refuseMemberChange(ACTOR, owner, change, 2)).toBeNull();
  });

  it("allows an owner to stay an owner", () => {
    expect(refuseMemberChange(ACTOR, owner, { kind: "role", to: RoleKey.OWNER }, 1)).toBeNull();
  });

  it("does not count a suspended owner as the one holding the company", () => {
    // They already can't administer anything, so nothing is being taken away.
    const suspended = member({ roleKey: RoleKey.OWNER, status: MembershipStatus.SUSPENDED });
    expect(refuseMemberChange(ACTOR, suspended, { kind: "remove" }, 1)).toBeNull();
  });

  it("lets a suspended owner be reactivated", () => {
    const suspended = member({ roleKey: RoleKey.OWNER, status: MembershipStatus.SUSPENDED });
    expect(refuseMemberChange(ACTOR, suspended, { kind: "reactivate" }, 0)).toBeNull();
  });

  it("does not protect somebody who was never an owner", () => {
    expect(refuseMemberChange(ACTOR, member(), { kind: "remove" }, 1)).toBeNull();
  });
});

describe("isRoleEditable", () => {
  it("refuses to let the owner profile be trimmed", () => {
    expect(isRoleEditable(RoleKey.OWNER)).toBe(false);
  });

  it.each([RoleKey.ADMIN, RoleKey.MANAGER, RoleKey.SALES, RoleKey.VIEWER])(
    "allows %s to be edited",
    (key) => {
      expect(isRoleEditable(key)).toBe(true);
    },
  );
});
