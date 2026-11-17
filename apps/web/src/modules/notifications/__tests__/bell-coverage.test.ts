import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NotificationKind } from "@/generated/prisma/enums";

/**
 * Reads the source and demands that every notification kind actually reaches
 * the bell.
 *
 * This exists because of a real gap. The bell was built wiring `notify()` into
 * whichever paths were open at the time, and four of the nine kinds were never
 * wired: a lead arriving, a quote being opened, a quote being decided, a
 * customer writing. They went out by email and the bell stayed empty — which is
 * to say, silent for everything a customer does, and loud only for tasks and
 * the nightly sweep. Somebody ran several tests and saw an empty panel.
 *
 * A sibling test already demands that every kind can be **turned off**; nothing
 * demanded that any of them be **turned on**. Reviewing a list by hand doesn't
 * catch that; comparing it against the source does.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === "__tests__" || entry === "generated") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

/** Every kind named inside a `notify(` or `notifyEach(` call. */
function raisedKinds(): Set<string> {
  const found = new Set<string>();

  for (const file of sourceFiles(join(process.cwd(), "src"))) {
    const source = readFileSync(file, "utf8");
    for (const call of source.matchAll(/\bnotify(?:Each)?\s*\(([\s\S]{0,700}?)\}\);/g)) {
      for (const [, kind] of call[1].matchAll(/NotificationKind\.(\w+)/g)) found.add(kind);
    }
  }

  return found;
}

describe("the bell", () => {
  it("has somebody raising every kind of notice", () => {
    const raised = raisedKinds();
    const missing = Object.values(NotificationKind).filter((kind) => !raised.has(kind));

    expect({ missing }).toEqual({ missing: [] });
  });

  /** Guards the guard: a broken scan would report everything as covered. */
  it("actually finds the calls it is looking for", () => {
    expect(raisedKinds().size).toBeGreaterThanOrEqual(Object.values(NotificationKind).length);
  });
});
