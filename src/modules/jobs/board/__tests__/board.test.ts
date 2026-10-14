import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STANDARD_POST_CATEGORIES, postCategoryName } from "../../categories";
import { idsFrom, MAX_ATTACHMENTS, notifyModeFrom, parseUploads, postSchema } from "../schemas";
import { excerptOf } from "../excerpt";

const upload = (n: number) => ({
  url: `https://x.public.blob.vercel-storage.com/companies/c/jobs/j/photo-${n}.jpg`,
  pathname: `companies/c/jobs/j/photo-${n}.jpg`,
  name: `photo-${n}.jpg`,
  width: 2560,
  height: 1920,
  thumbnail: null,
});

describe("parseUploads", () => {
  it("reads the attachment field's JSON", () => {
    expect(parseUploads(JSON.stringify([upload(1)]))).toEqual([upload(1)]);
  });

  it("reads anything malformed or forged as no files, not as an error", () => {
    expect(parseUploads(null)).toEqual([]);
    expect(parseUploads("")).toEqual([]);
    expect(parseUploads("{not json")).toEqual([]);
    expect(parseUploads(JSON.stringify([{ url: 1 }]))).toEqual([]);
    expect(parseUploads(JSON.stringify(Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, i) => upload(i))))).toEqual([]);
  });
});

describe("postSchema", () => {
  it("sanitises the body with the Message Board's profile on the way in", () => {
    const parsed = postSchema.parse({
      title: "  Day 3  ",
      body: '<h2>Walls</h2><p onclick="x()"><span style="color:#c92a2a">wet</span></p><script>1</script>',
      categoryId: "",
    });
    expect(parsed).toEqual({
      title: "Day 3",
      body: '<h2>Walls</h2><p><span style="color:#c92a2a">wet</span></p>',
      categoryId: null,
    });
  });

  it("stores an editor's empty paragraph as no body at all", () => {
    expect(postSchema.parse({ title: "x", body: "<p></p>" }).body).toBe("");
  });

  it("wants a title", () => {
    expect(postSchema.safeParse({ title: "   ", body: "" }).success).toBe(false);
  });
});

describe("who hears about a post", () => {
  it("defaults to the people following the job, and refuses anything else", () => {
    expect(notifyModeFrom("selected")).toBe("selected");
    expect(notifyModeFrom("nobody")).toBe("nobody");
    expect(notifyModeFrom("everyone-in-the-company")).toBe("followers");
    expect(notifyModeFrom(null)).toBe("followers");
  });

  it("drops empty and repeated ids", () => {
    expect(idsFrom(["u1", "", "u2", "u1"])).toEqual(["u1", "u2"]);
  });
});

describe("excerptOf", () => {
  it("is the post's first words, as plain text on one line", () => {
    expect(excerptOf("<h2>Day 3</h2><p>Walls <strong>wet</strong>.</p><ul><li>Lounge</li></ul>")).toBe("Day 3 Walls wet. • Lounge");
  });

  it("keeps a table's cells apart", () => {
    expect(excerptOf("<table><tr><th>Room</th><th>State</th></tr><tr><td>Lounge</td><td>Done</td></tr></table>")).toBe(
      "Room State Lounge Done",
    );
  });

  it("stops short of the limit with an ellipsis", () => {
    const excerpt = excerptOf(`<p>${"word ".repeat(100)}</p>`, 40);
    expect(excerpt.length).toBeLessThanOrEqual(40);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});

describe("standard categories", () => {
  it("are the same five the migration seeded for the companies already there", () => {
    const sql = readFileSync(
      join(process.cwd(), "prisma/migrations/20261015120000_job_message_board/migration.sql"),
      "utf8",
    );
    const seeded = [...sql.matchAll(/\('([A-Z]+)', '([^']+)', (\d+)\)/g)].map(([, key, emoji]) => ({ key, emoji }));
    expect(seeded).toEqual(STANDARD_POST_CATEGORIES.map(({ key, emoji }) => ({ key, emoji })));
  });

  it("read in the reader's words, and a company's own by its own name", () => {
    const t = (key: string) => `[${key}]`;
    expect(postCategoryName({ key: "QUESTION", name: null }, t)).toBe("[categories.QUESTION]");
    expect(postCategoryName({ key: "QUESTION", name: "Duda" }, t)).toBe("Duda");
    expect(postCategoryName({ key: null, name: "Site report" }, t)).toBe("Site report");
  });
});
