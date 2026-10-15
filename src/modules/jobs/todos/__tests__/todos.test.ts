import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isOverdue, isPermutationOf, newlyAssigned, progressOf } from "../rules";
import { orderSchema, todoListSchema, todoSchema } from "../schemas";
import { todoDatesLabel } from "../view";
import { commentHref, commentSubject, subjectPath, subjectReadPermission } from "../../comments/subject";

describe("isOverdue", () => {
  it("is late from the day after it was due, not on the day itself", () => {
    expect(isOverdue("2026-10-14", false, "2026-10-15")).toBe(true);
    expect(isOverdue("2026-10-15", false, "2026-10-15")).toBe(false);
    expect(isOverdue("2026-10-16", false, "2026-10-15")).toBe(false);
  });

  it("is never late once done, or without a due day", () => {
    expect(isOverdue("2026-01-01", true, "2026-10-15")).toBe(false);
    expect(isOverdue(null, false, "2026-10-15")).toBe(false);
  });
});

describe("isPermutationOf", () => {
  it("accepts the same ids in another order", () => {
    expect(isPermutationOf(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });

  it("refuses a reorder that adds, drops or repeats one — a stale screen or a forged post", () => {
    expect(isPermutationOf(["a", "b"], ["a", "b", "x"])).toBe(false);
    expect(isPermutationOf(["a", "b", "c"], ["a", "b"])).toBe(false);
    expect(isPermutationOf(["a", "b"], ["a", "a"])).toBe(false);
    expect(isPermutationOf(["a", "b"], ["a", "x"])).toBe(false);
  });
});

describe("newlyAssigned", () => {
  it("is only the people who weren't on it before", () => {
    expect(newlyAssigned(["u1", "u2"], ["u2", "u3"])).toEqual(["u3"]);
    expect(newlyAssigned([], ["u1"])).toEqual(["u1"]);
    expect(newlyAssigned(["u1"], [])).toEqual([]);
  });
});

describe("progressOf", () => {
  it("counts what is done out of everything", () => {
    expect(progressOf([{ completedAt: new Date() }, { completedAt: null }, { completedAt: null }])).toEqual({ done: 1, total: 3 });
    expect(progressOf([])).toEqual({ done: 0, total: 0 });
  });
});

describe("todoSchema", () => {
  const base = { title: "Sand the walls", notes: "", startsOn: "", dueOn: "" };

  it("reads blank days and blank notes as none", () => {
    const parsed = todoSchema.parse(base);
    expect(parsed).toEqual({ title: "Sand the walls", notes: null, startsOn: null, dueOn: null });
  });

  it("keeps the days as midnight UTC, which carries no timezone to drift by", () => {
    const parsed = todoSchema.parse({ ...base, startsOn: "2026-10-20", dueOn: "2026-10-22" });
    expect(parsed.dueOn?.toISOString()).toBe("2026-10-22T00:00:00.000Z");
  });

  it("refuses a due day before the start", () => {
    const result = todoSchema.safeParse({ ...base, startsOn: "2026-10-22", dueOn: "2026-10-20" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.dueOn).toEqual(["jobs.validation.endBeforeStart"]);
  });

  it("refuses a malformed day and an empty title", () => {
    expect(todoSchema.safeParse({ ...base, dueOn: "22/10/2026" }).success).toBe(false);
    expect(todoSchema.safeParse({ ...base, title: "   " }).success).toBe(false);
  });

  it("sanitises the notes in the Message Board's profile", () => {
    const parsed = todoSchema.parse({ ...base, notes: '<p onclick="x()">Use <mark data-color="#fff3bf" style="background-color: #fff3bf">the white</mark></p><script>1</script>' });
    expect(parsed.notes).not.toContain("onclick");
    expect(parsed.notes).not.toContain("script");
    expect(parsed.notes).toContain("<mark");
  });
});

describe("todoListSchema", () => {
  it("needs a name; the description is optional", () => {
    expect(todoListSchema.parse({ name: " Prep ", description: "<p></p>" })).toEqual({ name: "Prep", description: null });
    expect(todoListSchema.safeParse({ name: "", description: "" }).success).toBe(false);
  });
});

describe("orderSchema", () => {
  it("takes a list of ids and nothing else", () => {
    expect(orderSchema.safeParse(["a", "b"]).success).toBe(true);
    expect(orderSchema.safeParse([]).success).toBe(false);
    expect(orderSchema.safeParse("a,b").success).toBe(false);
    expect(orderSchema.safeParse([1, 2]).success).toBe(false);
  });
});

describe("todoDatesLabel", () => {
  const t = (key: string, values?: Record<string, string | number>) => `${key}${values ? JSON.stringify(values) : ""}`;
  const formatDay = (day: string) => day.slice(5);

  it("says a range, a due day, a start, or nothing", () => {
    expect(todoDatesLabel("2026-10-20", "2026-10-22", t, formatDay)).toBe('dates.range{"start":"10-20","end":"10-22"}');
    expect(todoDatesLabel(null, "2026-10-22", t, formatDay)).toBe('dates.due{"date":"10-22"}');
    expect(todoDatesLabel("2026-10-20", null, t, formatDay)).toBe('dates.starts{"date":"10-20"}');
    expect(todoDatesLabel(null, null, t, formatDay)).toBeNull();
  });
});

describe("comment subjects", () => {
  it("reads which thing a comment is on", () => {
    expect(commentSubject({ postId: "p", todoId: null, todoListId: null })).toEqual({ kind: "post", id: "p" });
    expect(commentSubject({ postId: null, todoId: "t", todoListId: null })).toEqual({ kind: "todo", id: "t" });
    expect(commentSubject({ postId: null, todoId: null, todoListId: "l" })).toEqual({ kind: "list", id: "l" });
    expect(commentSubject({ postId: null, todoId: null, todoListId: null })).toBeNull();
  });

  it("is read through the tool it belongs to", () => {
    expect(subjectReadPermission({ kind: "post", id: "p" })).toBe("messages.read");
    expect(subjectReadPermission({ kind: "todo", id: "t" })).toBe("todos.read");
    expect(subjectReadPermission({ kind: "list", id: "l" })).toBe("todos.read");
  });

  it("lives on the page of what it is about", () => {
    expect(subjectPath("j", { kind: "post", id: "p" })).toBe("/jobs/j/messages/p");
    expect(subjectPath("j", { kind: "todo", id: "t" })).toBe("/jobs/j/todos/t");
    expect(subjectPath("j", { kind: "list", id: "l" })).toBe("/jobs/j/todos/lists/l");
    expect(commentHref("j", { kind: "todo", id: "t" }, "c")).toBe("/jobs/j/todos/t#comment-c");
  });
});

/**
 * A comment's subject is held to exactly one by a check in the database. The
 * check is SQL and the keys are the schema, so nothing would notice a new
 * commentable thing added to one and not the other — this does.
 */
describe("JobComment's one-subject check", () => {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const model = schema.slice(schema.indexOf("model JobComment {"));
  const body = model.slice(0, model.indexOf("\n}"));
  // Every optional key but the author's: who wrote a comment is not what it is about.
  const subjectKeys = [...body.matchAll(/^\s+(\w+Id)\s+String\?/gm)]
    .map((m) => m[1])
    .filter((key) => key !== "authorId")
    .sort();

  const migrations = join(process.cwd(), "prisma/migrations");
  const latestCheck = readdirSync(migrations, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((dir) => readFileSync(join(migrations, dir, "migration.sql"), "utf8"))
    .flatMap((sql) => [...sql.matchAll(/"JobComment_one_subject" CHECK \(num_nonnulls\(([^)]*)\) = 1\)/g)].map((m) => m[1]))
    .pop();

  it("names every key a comment can hang off", () => {
    const checked = (latestCheck ?? "").split(",").map((key) => key.trim().replace(/"/g, "")).sort();
    expect(subjectKeys).toEqual(["postId", "todoId", "todoListId"]);
    expect(checked).toEqual(subjectKeys);
  });
});
