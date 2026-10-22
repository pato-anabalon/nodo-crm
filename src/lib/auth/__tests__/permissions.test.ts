import {
  ALL_PERMISSIONS,
  isPermission,
  permissionModule,
  permissionsByModule,
  PERMISSION_MODULES,
} from "../permissions";
import { ROLE_TEMPLATES, roleTemplate, templatePermissions } from "../role-templates";
import { RoleKey } from "@/generated/prisma/enums";

describe("permission catalogue", () => {
  it("every permission belongs to a declared module", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(PERMISSION_MODULES).toContain(permissionModule(permission));
    }
  });

  it("groups the catalogue without losing or repeating permissions", () => {
    const grouped = Object.values(permissionsByModule()).flat();
    expect(grouped.sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it("isPermission tells valid keys from invented ones", () => {
    expect(isPermission("leads.read")).toBe(true);
    expect(isPermission("leads.hackear")).toBe(false);
  });
});

describe("profile templates", () => {
  it("defines a template for every standard profile", () => {
    expect(ROLE_TEMPLATES.map((t) => t.key)).toEqual(Object.values(RoleKey));
  });

  it("the owner gets every permission", () => {
    expect(templatePermissions(roleTemplate(RoleKey.OWNER)).sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it("no standard profile but the owner starts with the quote export: each company hands it out", () => {
    for (const template of ROLE_TEMPLATES) {
      if (template.key === RoleKey.OWNER) continue;
      expect(templatePermissions(template)).not.toContain("quotes.export");
    }
  });

  it("only uses permissions that exist in the catalogue", () => {
    for (const template of ROLE_TEMPLATES) {
      for (const permission of templatePermissions(template)) {
        expect(isPermission(permission)).toBe(true);
      }
    }
  });

  it("the read-only profile cannot write anything", () => {
    const viewer = templatePermissions(roleTemplate(RoleKey.VIEWER));
    const writes = viewer.filter((p) => /\.(create|update|delete|send|decide|invite|remove|assign)$/.test(p));
    expect(writes).toEqual([]);
  });

  it("the sales rep sees neither the whole book nor the account settings", () => {
    const sales = templatePermissions(roleTemplate(RoleKey.SALES));
    expect(sales).not.toContain("leads.read.all");
    expect(sales).not.toContain("quotes.read.all");
    expect(sales).not.toContain("settings.update");
    expect(sales).not.toContain("roles.update");
  });

  it("the sales manager sees the whole team but does not administer profiles", () => {
    const manager = templatePermissions(roleTemplate(RoleKey.MANAGER));
    expect(manager).toContain("leads.read.all");
    expect(manager).toContain("leads.assign");
    expect(manager).not.toContain("roles.update");
    expect(manager).not.toContain("settings.update");
  });

  it("there are no duplicate permissions within a template", () => {
    for (const template of ROLE_TEMPLATES) {
      const permissions = templatePermissions(template);
      expect(new Set(permissions).size).toBe(permissions.length);
    }
  });

  /**
   * `quotes.read.amounts` hides a datum rather than an action, and it's new:
   * every standard profile starts seeing amounts same as before, since
   * nothing about existing companies should change until one of them
   * deliberately unticks it for a profile on the grid.
   */
  it("every standard profile sees quote amounts by default", () => {
    for (const key of [RoleKey.OWNER, RoleKey.ADMIN, RoleKey.MANAGER, RoleKey.SALES, RoleKey.VIEWER]) {
      expect(templatePermissions(roleTemplate(key))).toContain("quotes.read.amounts");
    }
  });

  const JOB_PROFILES = [RoleKey.PROJECT_LEAD, RoleKey.TEAM_LEAD, RoleKey.WORKER, RoleKey.COLLABORATOR];

  it("the people carrying out the work reach nothing of the sales side", () => {
    for (const key of JOB_PROFILES) {
      const granted = templatePermissions(roleTemplate(key));
      const outside = granted.filter((p) => !["jobs", "messages", "comments", "todos", "files", "schedule", "chat", "lineup"].includes(permissionModule(p)));
      expect({ key, outside }).toEqual({ key, outside: [] });
    }
  });

  it("only the project lead sees every job and moves a job's dates", () => {
    for (const key of JOB_PROFILES) {
      const granted = templatePermissions(roleTemplate(key));
      const expected = key === RoleKey.PROJECT_LEAD;
      expect(granted.includes("jobs.read.all")).toBe(expected);
      expect(granted.includes("jobs.dates")).toBe(expected);
      expect(granted.includes("jobs.members")).toBe(expected);
    }
  });

  it("an outside collaborator can tick a to-do off but not edit it", () => {
    const collaborator = templatePermissions(roleTemplate(RoleKey.COLLABORATOR));
    expect(collaborator).toContain("todos.complete");
    expect(collaborator).not.toContain("todos.update");
    expect(collaborator).not.toContain("schedule.update");
  });

  it("every job permission is granted by at least one template other than the owner's", () => {
    const granted = new Set(
      ROLE_TEMPLATES.filter((t) => t.key !== RoleKey.OWNER).flatMap((t) => templatePermissions(t)),
    );
    const jobModules = ["jobs", "messages", "comments", "todos", "files", "schedule", "chat", "lineup"];
    const missing = ALL_PERMISSIONS.filter((p) => jobModules.includes(permissionModule(p)) && !granted.has(p));
    expect(missing).toEqual([]);
  });
});
