import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { JobBoard } from "@/generated/prisma/enums";
import { JOB_BOARDS, BOARDS } from "@nodo/core/jobs/boards";
import { ALL_PERMISSIONS } from "@nodo/core/auth/permissions";
import { ROLE_TEMPLATES, templatePermissions } from "@/lib/auth/role-templates";

/**
 * A confidential post is a Message Board post with another board on it, so
 * the one way it reaches the crew is a query that forgets to say which board
 * it reads. Nothing would fail: the list would simply show the contract. So
 * these read the source.
 */

const SRC = join(process.cwd(), "src");
const SERVICE = join(SRC, "modules/jobs/board/service.ts");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "generated" ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

it("reads posts in the board service and nowhere else", () => {
  const outside = sources(SRC)
    .filter((file) => file !== SERVICE && /\.jobPost\./.test(readFileSync(file, "utf8")))
    .map((file) => relative(SRC, file));
  expect(outside).toEqual([]);
});

it("names the board in every query that reads posts", () => {
  const source = readFileSync(SERVICE, "utf8");
  const reads = [...source.matchAll(/\.jobPost\.(findMany|findFirst|findUnique|count|aggregate|groupBy)\(/g)];
  expect(reads.length).toBeGreaterThan(0);
  for (const read of reads) {
    // The call's own argument, up to its closing parenthesis.
    let depth = 0;
    let end = read.index! + read[0].length - 1;
    for (; end < source.length; end++) {
      if (source[end] === "(") depth++;
      if (source[end] === ")" && --depth === 0) break;
    }
    const call = source.slice(read.index, end + 1);
    expect({ call, board: /\bboard\b|published\(/.test(call) }).toEqual({ call, board: true });
  }
});

it("knows the database's boards", () => {
  expect([...JOB_BOARDS].sort()).toEqual(Object.values(JobBoard).sort());
});

it("opens each board with permissions of its own", () => {
  const all = new Set<string>(ALL_PERMISSIONS);
  const used = JOB_BOARDS.flatMap((board) => [BOARDS[board].read, BOARDS[board].create, BOARDS[board].update, BOARDS[board].delete]);
  for (const permission of used) expect(all.has(permission)).toBe(true);
  expect(new Set(used).size).toBe(used.length);
});

it("gives the confidential board to nobody but the owner by default", () => {
  const holders = ROLE_TEMPLATES.filter((template) =>
    templatePermissions(template).some((permission) => permission.startsWith("confidential.")),
  ).map((template) => template.key);
  expect(holders).toEqual(["OWNER"]);
});
