import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chatBody } from "../schemas";
import { chatExcerpt, chatSegments, mentionedIn, mentionQuery, MAX_CHAT_LENGTH } from "../text";

const ana = { id: "u1", name: "Ana" };
const anaMaria = { id: "u2", name: "Ana María" };
const rolando = { id: "u3", name: "Rolando Reveco" };
const people = [ana, anaMaria, rolando];

describe("mentionedIn", () => {
  it("finds a name after @, whatever its case", () => {
    expect(mentionedIn("@rolando reveco can you check?", people)).toEqual(["u3"]);
  });

  it("takes the longest name that fits", () => {
    expect(mentionedIn("@Ana María and @Ana", people)).toEqual(["u2", "u1"]);
  });

  it("needs the name to end at a word boundary", () => {
    expect(mentionedIn("@Anabel is here", people)).toEqual([]);
    expect(mentionedIn("thanks @Ana!", people)).toEqual(["u1"]);
  });

  it("doesn't read an email address as a mention", () => {
    expect(mentionedIn("write to ana@Ana.co.nz", people)).toEqual([]);
  });

  it("names each person once, and nobody for a name without @", () => {
    expect(mentionedIn("@Ana @Ana Ana", people)).toEqual(["u1"]);
    expect(mentionedIn("Rolando Reveco", people)).toEqual([]);
  });
});

describe("chatSegments", () => {
  it("cuts the text into plain text, mentions and links", () => {
    expect(chatSegments("@Ana see https://example.com/a?b=1.", [ana])).toEqual([
      { type: "mention", text: "@Ana", userId: "u1" },
      { type: "text", text: " see " },
      { type: "link", text: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { type: "text", text: "." },
    ]);
  });

  it("only draws the people the message was stored as mentioning", () => {
    expect(chatSegments("@Ana hi", [])).toEqual([{ type: "text", text: "@Ana hi" }]);
  });

  it("leaves anything that isn't http(s) as text", () => {
    expect(chatSegments("javascript:alert(1)", [])).toEqual([{ type: "text", text: "javascript:alert(1)" }]);
  });

  it("returns nothing for an empty message (files only)", () => {
    expect(chatSegments("", [ana])).toEqual([]);
  });
});

describe("mentionQuery", () => {
  it("is what follows an @ at the start or after a space", () => {
    expect(mentionQuery("hey @ro")).toEqual({ query: "ro", start: 4 });
    expect(mentionQuery("@")).toEqual({ query: "", start: 0 });
  });

  it("is nothing inside an email or once a space ends it", () => {
    expect(mentionQuery("ana@ex")).toBeNull();
    expect(mentionQuery("@ro ")).toBeNull();
  });
});

describe("chatBody", () => {
  it("trims, folds blank lines and keeps single breaks", () => {
    expect(chatBody("  one\r\n\r\n\r\n\r\ntwo\nthree  ")).toBe("one\n\ntwo\nthree");
  });

  it("cuts a long paste at the limit rather than refusing it", () => {
    expect(chatBody("x".repeat(MAX_CHAT_LENGTH + 10))).toHaveLength(MAX_CHAT_LENGTH);
  });

  it("reads a missing field as empty", () => {
    expect(chatBody(null)).toBe("");
  });
});

describe("chatExcerpt", () => {
  it("is one line, cut with an ellipsis", () => {
    expect(chatExcerpt("a\n\nb   c")).toBe("a b c");
    expect(chatExcerpt("abcdefghij", 5)).toBe("abcd…");
  });
});

describe("where a file lives", () => {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const model = /model JobFile \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
  // Every optional key that points at a place a file can live; who uploaded
  // it is a person, not a place.
  const homeKeys = [...model.matchAll(/^\s+(\w+Id)\s+String\?/gm)]
    .map((m) => m[1])
    .filter((key) => key !== "uploadedById")
    .sort();

  const migrations = join(process.cwd(), "prisma/migrations");
  const latestCheck = readdirSync(migrations, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((dir) => readFileSync(join(migrations, dir, "migration.sql"), "utf8"))
    .flatMap((sql) => [...sql.matchAll(/"JobFile_one_home" CHECK \(num_nonnulls\(([^)]*)\) <= 1\)/g)].map((m) => m[1]))
    .pop();

  it("holds every home in the database check, chat messages included", () => {
    const checked = (latestCheck ?? "").split(",").map((key) => key.trim().replace(/"/g, "")).sort();
    expect(homeKeys).toEqual(["chatMessageId", "commentId", "folderId", "postId", "todoId"]);
    expect(checked).toEqual(homeKeys);
  });
});
