import { JobActivityType } from "@/generated/prisma/enums";
import { activityFileIds, activityPermission, dayIn, describeJobActivity, groupByDay } from "../timeline";

const at = (iso: string) => ({ createdAt: new Date(iso) });

describe("dayIn", () => {
  it("draws the day in the company's timezone, not the server's", () => {
    // 11:30 UTC on the 10th is already the 11th in Auckland.
    expect(dayIn(new Date("2026-10-10T11:30:00Z"), "Pacific/Auckland")).toBe("2026-10-11");
    expect(dayIn(new Date("2026-10-10T11:30:00Z"), "UTC")).toBe("2026-10-10");
  });
});

describe("groupByDay", () => {
  const now = new Date("2026-10-13T12:00:00Z");

  it("puts entries of the same day under one heading", () => {
    const days = groupByDay([at("2026-10-13T10:00:00Z"), at("2026-10-13T08:00:00Z")], "UTC", now);
    expect(days).toHaveLength(1);
    expect(days[0].entries).toHaveLength(2);
    expect(days[0].quietBefore).toBe(0);
  });

  it("counts the silent days between headings", () => {
    const days = groupByDay([at("2026-10-11T10:00:00Z"), at("2026-04-17T10:00:00Z")], "UTC", now);
    expect(days.map((d) => [d.day, d.quietBefore])).toEqual([
      ["2026-10-11", 1],
      ["2026-04-17", 176],
    ]);
  });

  it("has nothing to say about an empty timeline", () => {
    expect(groupByDay([], "UTC", now)).toEqual([]);
  });
});

describe("describeJobActivity", () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    `${key}${values ? JSON.stringify(values) : ""}`;
  const helpers = {
    nameOf: (id: string) => ({ u1: "Ana", u2: "Bo" })[id] ?? "?",
    list: (names: string[]) => names.join(" & "),
    formatDay: (day: string) => day,
  };

  it("says when a job came from a quote", () => {
    expect(
      describeJobActivity({ type: JobActivityType.CREATED, params: { quoteNumber: "COT-000123" }, actorName: "Rolando" }, t, helpers),
    ).toBe('CREATED_fromQuote{"actor":"Rolando","reference":"COT-000123"}');
  });

  it("names the people added", () => {
    expect(
      describeJobActivity({ type: JobActivityType.MEMBERS_ADDED, params: { userIds: ["u1", "u2"] }, actorName: "R" }, t, helpers),
    ).toBe('MEMBERS_ADDED{"actor":"R","names":"Ana & Bo"}');
  });

  it("translates a status token and passes an unknown one through", () => {
    expect(
      describeJobActivity({ type: JobActivityType.STATUS_CHANGED, params: { to: "COMPLETED" }, actorName: "R" }, t, helpers),
    ).toBe('STATUS_CHANGED{"actor":"R","to":"status.COMPLETED"}');
    expect(
      describeJobActivity({ type: JobActivityType.STATUS_CHANGED, params: { to: "WEIRD" }, actorName: "R" }, t, helpers),
    ).toBe('STATUS_CHANGED{"actor":"R","to":"WEIRD"}');
  });

  it("says the dates were cleared rather than set to nothing", () => {
    expect(
      describeJobActivity({ type: JobActivityType.DATES_CHANGED, params: { startsOn: null, endsOn: null }, actorName: "R" }, t, helpers),
    ).toBe('DATES_CLEARED{"actor":"R"}');
  });

  it("survives malformed params and a missing author", () => {
    expect(describeJobActivity({ type: JobActivityType.MEMBERS_ADDED, params: null, actorName: null }, t, helpers)).toBe(
      'MEMBERS_ADDED{"actor":"someone","names":""}',
    );
  });
});

describe("file lines", () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    `${key}${values ? JSON.stringify(values) : ""}`;
  const helpers = { nameOf: (id: string) => id, list: (names: string[]) => names.join(", "), formatDay: (d: string) => d };

  it("says how many files went up in the batch", () => {
    expect(
      describeJobActivity({ type: JobActivityType.FILES_UPLOADED, params: { count: 12, fileIds: [] }, actorName: "Ana" }, t, helpers),
    ).toBe('FILES_UPLOADED{"actor":"Ana","count":12}');
  });

  it("belongs to Docs & Files, so a profile without it doesn't see the line", () => {
    expect(activityPermission(JobActivityType.FILES_UPLOADED)).toBe("files.read");
    expect(activityPermission(JobActivityType.FOLDER_CREATED)).toBe("files.read");
    expect(activityPermission(JobActivityType.STATUS_CHANGED)).toBe("jobs.read");
  });

  it("reads the thumbnails' ids defensively", () => {
    expect(activityFileIds({ fileIds: ["a", 3, "b"] })).toEqual(["a", "b"]);
    expect(activityFileIds(null)).toEqual([]);
  });
});
