import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { MESSAGES } from "@/test/intl";

/**
 * Reads the source and demands that a message taking an argument is never
 * called without one.
 *
 * A missing argument is a `FORMATTING_ERROR`, and next-intl handles it by
 * logging to the console and rendering the raw message — so the screen shows
 * "Which emails you want from {company}" and the page is otherwise fine. That
 * is the whole problem: nothing fails, the HTML carries no error, and the only
 * trace is a line in a console nobody has open. It shipped on the settings
 * index, where the card reused a subtitle the notifications page had always
 * passed the company name to.
 *
 * Its sibling above checks the two languages agree about the arguments. Neither
 * of them knew whether anybody was passing them.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === "__tests__" || entry === "generated") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

function isArgument(node: MessageFormatElement): boolean {
  return (
    node.type === TYPE.argument ||
    node.type === TYPE.number ||
    node.type === TYPE.date ||
    node.type === TYPE.time ||
    node.type === TYPE.select ||
    node.type === TYPE.plural
  );
}

/** The arguments a message needs, including the ones a plural or select keys on. */
function argumentsOf(text: string): string[] {
  const names = new Set<string>();
  const walk = (nodes: MessageFormatElement[]) => {
    for (const node of nodes) {
      if ("value" in node && typeof node.value === "string" && isArgument(node)) names.add(node.value);
      if ("options" in node && node.options) {
        for (const option of Object.values(node.options) as Array<{ value: MessageFormatElement[] }>) {
          walk(option.value);
        }
      }
      if ("children" in node && node.children) walk(node.children as MessageFormatElement[]);
    }
  };
  walk(parse(text));
  return [...names];
}

/**
 * Which namespace each `t`-like name in a file reads from.
 *
 * Both shapes this codebase uses: the plain `const t = useTranslations("ns")`,
 * and the `Promise.all` array that pages with several namespaces destructure —
 * paired by position, which is the only thing that pairs them.
 */
function namespaces(source: string): Map<string, string> {
  const found = new Map<string, string>();

  for (const [, name, namespace] of source.matchAll(
    /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*"([^"]+)"/g,
  )) {
    found.set(name, namespace);
  }

  for (const [, names, calls] of source.matchAll(
    /const\s*\[([^\]]+)\]\s*=\s*\n?\s*await\s+Promise\.all\(\[([\s\S]*?)\]\)/g,
  )) {
    const bound = names.split(",").map((part) => part.trim()).filter(Boolean);
    const list = [...calls.matchAll(/getTranslations\(\s*"([^"]+)"/g)].map(([, ns]) => ns);
    bound.forEach((name, index) => list[index] && found.set(name, list[index]));
  }

  return found;
}

describe("message arguments", () => {
  it("are supplied wherever the message asks for one", () => {
    const root = join(process.cwd(), "src");
    const english = MESSAGES["en-GB"];
    const read = (key: string) =>
      key.split(".").reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        english,
      );

    const missing: string[] = [];

    for (const file of sourceFiles(root)) {
      const source = readFileSync(file, "utf8");

      for (const [name, namespace] of namespaces(source)) {
        // Only the bare `t("key")` — a call with a second argument is passing
        // something, and whether it is the right something is TypeScript's job.
        const bare = new RegExp(`\\b${name}\\(\\s*"([^"]+)"\\s*\\)`, "g");

        for (const match of source.matchAll(bare)) {
          const key = `${namespace}.${match[1]}`;
          const message = read(key);
          // An unresolved key is a namespace this scan paired up wrongly, not a
          // finding. Missing keys are the sibling test's job.
          if (typeof message !== "string") continue;

          const needs = argumentsOf(message);
          if (needs.length === 0) continue;

          const line = source.slice(0, match.index).split("\n").length;
          missing.push(`${relative(process.cwd(), file)}:${line} — ${key} needs {${needs.join(", ")}}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
