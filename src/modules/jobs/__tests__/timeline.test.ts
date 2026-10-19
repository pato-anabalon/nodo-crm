import { JobActivityType } from "@/generated/prisma/enums";
import { activityFileIds, activityHref, activityPermission, dayIn, describeJobActivity, groupByDay } from "../timeline";

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

describe("Message Board lines", () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    `${key}${values ? JSON.stringify(values) : ""}`;
  const helpers = { nameOf: () => "?", list: (names: string[]) => names.join(), formatDay: (day: string) => day };

  it("names the post a line is about, by the title it went out under", () => {
    expect(
      describeJobActivity({ type: JobActivityType.POST_PUBLISHED, params: { postId: "p1", title: "Day 3" }, actorName: "Ana" }, t, helpers),
    ).toBe('POST_PUBLISHED{"actor":"Ana","title":"Day 3"}');
    expect(
      describeJobActivity({ type: JobActivityType.COMMENT_ADDED, params: { postId: "p1", commentId: "c1", title: "Day 3" }, actorName: "Bo" }, t, helpers),
    ).toBe('COMMENT_ADDED{"actor":"Bo","title":"Day 3"}');
  });

  it("belongs to the Message Board, so a profile without it doesn't see the lines", () => {
    expect(activityPermission(JobActivityType.POST_PUBLISHED)).toBe("messages.read");
    expect(activityPermission(JobActivityType.COMMENT_ADDED)).toBe("messages.read");
  });

  it("leads to the post, and to the comment on it", () => {
    expect(activityHref("j1", JobActivityType.POST_PUBLISHED, { postId: "p1" })).toBe("/jobs/j1/messages/p1");
    expect(activityHref("j1", JobActivityType.COMMENT_ADDED, { postId: "p1", commentId: "c1" })).toBe(
      "/jobs/j1/messages/p1#comment-c1",
    );
  });

  it("leads files to their folder, and the job's own lines nowhere", () => {
    expect(activityHref("j1", JobActivityType.FILES_UPLOADED, { folderId: "f1" })).toBe("/jobs/j1/files?folder=f1");
    expect(activityHref("j1", JobActivityType.FILES_UPLOADED, { folderId: null })).toBe("/jobs/j1/files");
    expect(activityHref("j1", JobActivityType.STATUS_CHANGED, { to: "COMPLETED" })).toBeNull();
  });

  it("leads nowhere when the params are broken, rather than to /undefined", () => {
    expect(activityHref("j1", JobActivityType.POST_PUBLISHED, null)).toBeNull();
    expect(activityHref("j1", JobActivityType.COMMENT_ADDED, { postId: 7 })).toBeNull();
  });
});

describe("To-do lines", () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    `${key}${values ? JSON.stringify(values) : ""}`;
  const helpers = { nameOf: () => "?", list: (names: string[]) => names.join(), formatDay: (day: string) => day };
  const todoTypes = [
    JobActivityType.TODO_ADDED,
    JobActivityType.TODO_COMPLETED,
    JobActivityType.TODO_REOPENED,
    JobActivityType.TODO_COMMENTED,
  ];

  it("names the to-do, and says which way it was ticked", () => {
    for (const type of todoTypes) {
      expect(
        describeJobActivity({ type, params: { listId: "l1", todoId: "t1", title: "Sand walls" }, actorName: "Ana" }, t, helpers),
      ).toBe(`${type}{"actor":"Ana","title":"Sand walls"}`);
    }
    expect(
      describeJobActivity({ type: JobActivityType.TODO_LIST_CREATED, params: { listId: "l1", name: "Prep" }, actorName: "Ana" }, t, helpers),
    ).toBe('TODO_LIST_CREATED{"actor":"Ana","name":"Prep"}');
  });

  it("belongs to the to-dos, so a profile without them doesn't see the lines", () => {
    for (const type of [...todoTypes, JobActivityType.TODO_LIST_CREATED]) {
      expect(activityPermission(type)).toBe("todos.read");
    }
  });

  it("leads to the to-do, the list, or the comment on either", () => {
    expect(activityHref("j1", JobActivityType.TODO_COMPLETED, { listId: "l1", todoId: "t1" })).toBe("/jobs/j1/todos/t1");
    expect(activityHref("j1", JobActivityType.TODO_LIST_CREATED, { listId: "l1" })).toBe("/jobs/j1/todos/lists/l1");
    expect(activityHref("j1", JobActivityType.TODO_COMMENTED, { listId: "l1", todoId: "t1", commentId: "c1" })).toBe(
      "/jobs/j1/todos/t1#comment-c1",
    );
    expect(activityHref("j1", JobActivityType.TODO_COMMENTED, { listId: "l1", commentId: "c1" })).toBe(
      "/jobs/j1/todos/lists/l1#comment-c1",
    );
  });

  it("leads nowhere when the params are broken", () => {
    expect(activityHref("j1", JobActivityType.TODO_ADDED, { listId: "l1" })).toBeNull();
    expect(activityHref("j1", JobActivityType.TODO_COMMENTED, {})).toBeNull();
  });
});

describe("Schedule lines", () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    `${key}${values ? JSON.stringify(values) : ""}`;
  const helpers = { nameOf: () => "?", list: (names: string[]) => names.join(), formatDay: (day: string) => `<${day}>` };

  it("names the event and the day it is for", () => {
    expect(
      describeJobActivity({ type: JobActivityType.EVENT_CREATED, params: { eventId: "e1", title: "Scaffold", startsOn: "2026-10-20" }, actorName: "Ana" }, t, helpers),
    ).toBe('EVENT_CREATED{"actor":"Ana","title":"Scaffold","date":"<2026-10-20>"}');
    expect(
      describeJobActivity({ type: JobActivityType.EVENT_CREATED, params: { eventId: "e1", title: "Scaffold" }, actorName: "Ana" }, t, helpers),
    ).toBe('EVENT_CREATED_undated{"actor":"Ana","title":"Scaffold"}');
  });

  it("belongs to the Schedule, and leads to the event or the comment on it", () => {
    expect(activityPermission(JobActivityType.EVENT_CREATED)).toBe("schedule.read");
    expect(activityPermission(JobActivityType.EVENT_COMMENTED)).toBe("schedule.read");
    expect(activityHref("j1", JobActivityType.EVENT_CREATED, { eventId: "e1" })).toBe("/jobs/j1/schedule/e1");
    expect(activityHref("j1", JobActivityType.EVENT_COMMENTED, { eventId: "e1", commentId: "c1" })).toBe("/jobs/j1/schedule/e1#comment-c1");
    expect(activityHref("j1", JobActivityType.EVENT_CREATED, {})).toBeNull();
  });
});

describe("Chat lines", () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    `${key}${values ? JSON.stringify(values) : ""}`;
  const helpers = { nameOf: () => "?", list: (names: string[]) => names.join(), formatDay: (day: string) => day };

  it("counts a person's messages for the day in one line", () => {
    expect(
      describeJobActivity({ type: JobActivityType.CHAT_MESSAGES, params: { day: "2026-10-15", count: 12 }, actorName: "Ana" }, t, helpers),
    ).toBe('CHAT_MESSAGES{"actor":"Ana","count":12}');
  });

  it("belongs to the Chat, and leads to it", () => {
    expect(activityPermission(JobActivityType.CHAT_MESSAGES)).toBe("chat.read");
    expect(activityHref("j1", JobActivityType.CHAT_MESSAGES, { day: "2026-10-15", count: 1 })).toBe("/jobs/j1/chat");
  });
});
