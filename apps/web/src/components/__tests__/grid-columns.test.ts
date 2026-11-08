import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A grid's implicit column is `auto`, and `auto` grows to the widest thing
 * inside it. A grid that only names its columns from a breakpoint up (`lg:grid-cols-3`)
 * has exactly that one column on a phone, so a long title or address inside it
 * widens the column and with it the whole page. `grid-cols-1` is
 * `minmax(0, 1fr)`: the column can no longer be wider than the screen.
 *
 * jsdom computes no layout, so this reads the source for the cause.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "__tests__" || name === "generated" || name === "marketing" ? [] : sourceFiles(path);
    }
    // The public landing page has its own fixed layouts.
    return /\.tsx$/.test(name) && path !== join(process.cwd(), "src/app/page.tsx") ? [path] : [];
  });
}

const IMPLICIT = /(^|\s)grid(\s|$)/;
const FROM_A_BREAKPOINT = /(sm|md|lg|xl|@\w+):grid-cols-/;
const NAMED_FROM_THE_START = /(^|\s)grid-cols-/;

describe("grids that name their columns only from a breakpoint up", () => {
  const offenders = sourceFiles(join(process.cwd(), "src")).flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        [...line.matchAll(/(["`'])([^"`'\n]*)\1/g)]
          .map((match) => match[2] ?? "")
          .filter((classes) => IMPLICIT.test(classes) && FROM_A_BREAKPOINT.test(classes) && !NAMED_FROM_THE_START.test(classes))
          .map((classes) => `${file.replace(process.cwd() + "/", "")}:${index + 1}  "${classes}"`),
      ),
  );

  it("say grid-cols-1 as well, so a phone's single column can't outgrow the screen", () => {
    expect(offenders).toEqual([]);
  });
});
