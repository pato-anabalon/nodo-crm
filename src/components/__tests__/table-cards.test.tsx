import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

describe("<Table cards>", () => {
  function sample(cards: boolean) {
    return render(
      <Table cards={cards}>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Leads</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell primary>Ana</TableCell>
            <TableCell label="Leads">12</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
  }

  it("marks the table, the title cell and each labelled cell for the stylesheet", () => {
    const { container } = sample(true);

    expect(container.querySelector("table")?.hasAttribute("data-cards")).toBe(true);
    expect(container.querySelector("td[data-primary]")?.textContent).toBe("Ana");
    expect(container.querySelector("td[data-label]")?.getAttribute("data-label")).toBe("Leads");
  });

  it("leaves a plain table alone, and never puts the props on the DOM as attributes", () => {
    const { container } = sample(false);

    expect(container.querySelector("table")?.hasAttribute("data-cards")).toBe(false);
    // `label` and `primary` are this component's, not HTML's.
    expect(container.querySelector("td[label]")).toBeNull();
    expect(container.querySelector("td[primary]")).toBeNull();
  });

  it("keeps the header in the document: it is hidden on a phone, not removed", () => {
    const { container } = sample(true);
    expect(container.querySelector("thead")?.textContent).toContain("Leads");
  });
});

/**
 * The stylesheet is what makes a table a list of cards, and jsdom computes no
 * CSS, so the rules are checked at the source: that they exist, that they sit
 * under the phone breakpoint, and that the hidden header has somewhere to hang.
 */
describe("the card rules in globals.css", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const block = css.slice(css.indexOf("@media (width < 40rem)"));

  it("only apply below the phone breakpoint, and only to a table that opted in", () => {
    expect(css).toContain("@media (width < 40rem)");
    expect(block).toContain("table[data-cards]");
  });

  it("sit outside every @layer, so they beat the primitives' own utilities", () => {
    const before = css.slice(0, css.indexOf("@media (width < 40rem)"));
    const opened = (before.match(/@layer[^{]*\{/g) ?? []).length;
    // Count the braces that close each layer: if one were still open here, the
    // rules would be inside it and lose to the utilities again.
    let depth = 0;
    for (const char of before.slice(before.search(/@layer[^{]*\{/))) {
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
    }
    expect(opened).toBeGreaterThan(0);
    expect(depth).toBe(0);
  });

  it("take the border off the card that wraps a table, so the cards aren't inside a second one", () => {
    expect(block).toContain('[data-slot="card"]:has(> [data-slot="table-container"] > table[data-cards])');
  });

  it("position the table, because the hidden header is absolutely positioned and would otherwise hang off the document", () => {
    expect(block).toMatch(/table\[data-cards\]\s*\{[^}]*position:\s*relative/);
    expect(block).toMatch(/table\[data-cards\] thead\s*\{[^}]*position:\s*absolute/);
  });
});

/**
 * A card with a value and no name is a number floating on a card. Every screen
 * that opts in has to say what each cell is called, and that is easy to forget
 * for the fifth column, so this reads the screens rather than trusting memory.
 */
describe("every screen that uses <Table cards>", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === "__tests__" || name === "generated" ? [] : sourceFiles(path);
      return /\.tsx$/.test(name) ? [path] : [];
    });
  }

  const files = sourceFiles(join(process.cwd(), "src")).filter((file) =>
    /<Table\s+[^>]*\bcards\b/.test(readFileSync(file, "utf8")),
  );

  it("exists at least once, so this guard is checking something", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [file.replace(process.cwd() + "/", ""), file]))(
    "%s labels every body cell or marks it as the title",
    (_name, file) => {
      const source = readFileSync(file as string, "utf8");
      const body = source.slice(source.indexOf("<TableBody"));
      const cells = [...body.matchAll(/<TableCell\b([^>]*)>/g)].map((match) => match[1] ?? "");

      for (const attributes of cells) {
        // A spanning "nothing here" cell has no column to be named after.
        if (/colSpan/.test(attributes)) continue;
        expect(attributes).toMatch(/\blabel=|\bprimary\b|\bactions\b/);
      }
    },
  );
});
