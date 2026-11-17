import { jobsHref, matchesJobName, normaliseJobPage, normaliseJobQuery } from "../search";

describe("normaliseJobQuery", () => {
  it("trims, and treats blank or missing as no search", () => {
    expect(normaliseJobQuery("  Irene  ")).toBe("Irene");
    expect(normaliseJobQuery("   ")).toBeUndefined();
    expect(normaliseJobQuery(undefined)).toBeUndefined();
    expect(normaliseJobQuery(["a", "b"])).toBeUndefined();
  });

  it("caps the length", () => {
    expect(normaliseJobQuery("x".repeat(500))).toHaveLength(200);
  });
});

describe("matchesJobName", () => {
  it("matches anywhere in the name, ignoring case", () => {
    expect(matchesJobName("1A Irene Avenue - COT-000123", "irene")).toBe(true);
    expect(matchesJobName("1A Irene Avenue - COT-000123", "cot-000123")).toBe(true);
    expect(matchesJobName("1A Irene Avenue", "Queen")).toBe(false);
  });

  it("matches everything with no query", () => {
    expect(matchesJobName("Anything", undefined)).toBe(true);
  });
});

describe("jobsHref", () => {
  it("keeps the search across tabs and leaves the plain list bare", () => {
    expect(jobsHref("active")).toBe("/jobs");
    expect(jobsHref("done")).toBe("/jobs?show=done");
    expect(jobsHref("done", "Irene St")).toBe("/jobs?show=done&q=Irene+St");
    expect(jobsHref("active", "Irene")).toBe("/jobs?q=Irene");
  });
});

describe("normaliseJobPage", () => {
  it("takes a whole page number and falls back to the first", () => {
    expect(normaliseJobPage("3")).toBe(3);
    for (const raw of [undefined, "", "0", "-2", "1.5", "abc", ["2"]]) expect(normaliseJobPage(raw)).toBe(1);
  });
});

describe("jobsHref with a page", () => {
  it("carries the page beside the search, and drops the first", () => {
    expect(jobsHref("done", "Irene", 2)).toBe("/jobs?show=done&q=Irene&page=2");
    expect(jobsHref("done", undefined, 1)).toBe("/jobs?show=done");
  });
});
