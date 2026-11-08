import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { isJobClosed, isWritePermission, withoutWrites } from "../closing";

describe("isJobClosed", () => {
  it("is COMPLETED and nothing else", () => {
    expect(isJobClosed("COMPLETED")).toBe(true);
    for (const status of ["ACTIVE", "ON_HOLD", "ARCHIVED"]) expect(isJobClosed(status)).toBe(false);
  });
});

describe("isWritePermission", () => {
  it("treats every read as a read", () => {
    const reads = PERMISSIONS.filter((p) => p.endsWith(".read") || p === "jobs.read.all");
    expect(reads.length).toBeGreaterThan(5);
    for (const permission of reads) expect(isWritePermission(permission)).toBe(false);
  });

  it("treats creating, changing, completing and moderating as writes", () => {
    const writes: Permission[] = [
      "jobs.update",
      "jobs.dates",
      "jobs.members",
      "jobs.moderate",
      "messages.create",
      "comments.update",
      "todos.complete",
      "schedule.delete",
      "files.create",
      "chat.create",
    ];
    for (const permission of writes) expect(isWritePermission(permission)).toBe(true);
  });

  it("lets finishing, reopening and deleting through a finished job", () => {
    for (const permission of ["jobs.finish", "jobs.reopen", "jobs.delete"] as const) {
      expect(isWritePermission(permission)).toBe(false);
    }
  });

  it("locks a permission nobody has thought about yet", () => {
    // Anything that isn't a read is a write: a new verb is shut by default.
    expect(isWritePermission("tools.archive" as Permission)).toBe(true);
  });
});

describe("withoutWrites", () => {
  it("keeps what reads and what unlocks, and drops the rest", () => {
    const ctx = {
      permissions: new Set<Permission>(["jobs.read", "todos.read", "todos.create", "jobs.update", "jobs.reopen", "jobs.delete"]),
    };
    const closed = withoutWrites(ctx);
    expect([...closed.permissions].sort()).toEqual(["jobs.delete", "jobs.read", "jobs.reopen", "todos.read"]);
    // The original is not touched: it still belongs to the session.
    expect(ctx.permissions.has("todos.create")).toBe(true);
  });
});

/**
 * The lock lives in one place, `requireJobContext`, so it only holds while every
 * job action goes through it. A new actions file that wrote to a job without
 * calling it would be open on a finished one with nothing failing.
 */
describe("job actions all pass through the guard", () => {
  const root = join(__dirname, "..");
  const actionFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === "__tests__" ? [] : actionFiles(path);
      return /actions\.ts$/.test(name) ? [path] : [];
    });

  it.each(actionFiles(root))("%s", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).toMatch(/requireJobContext\(|Guard\(/);
  });
});
