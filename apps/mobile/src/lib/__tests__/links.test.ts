import { appHref } from "../links";

describe("appHref", () => {
  it("opens a to-do, a post and a chat on their own screens", () => {
    expect(appHref("/jobs/j1/todos/t1")).toBe("/todos/t1");
    expect(appHref("/jobs/j1/todos/t1#comment-c9")).toBe("/todos/t1");
    expect(appHref("/jobs/j1/messages/p1#comment-c2")).toBe("/posts/p1");
    expect(appHref("/jobs/j1/chat#message-m4")).toBe("/jobs/j1/chat");
  });

  it("takes what the app has no screen for to the nearest one it has", () => {
    expect(appHref("/jobs/j1/todos/lists/l1#comment-c1")).toBe("/jobs/j1/todos");
    expect(appHref("/jobs/j1/schedule/e1")).toBe("/jobs/j1/schedule");
    expect(appHref("/jobs/j1/docs/f1")).toBe("/jobs/j1/files");
    expect(appHref("/jobs/j1")).toBe("/jobs/j1");
    expect(appHref("/jobs")).toBe("/");
  });

  it("leaves the web's own work on the web", () => {
    expect(appHref("/leads/l1")).toBeNull();
    expect(appHref("/quotes/q1")).toBeNull();
    expect(appHref("/tasks")).toBeNull();
    expect(appHref("https://example.com/jobs/j1")).toBeNull();
    expect(appHref(null)).toBeNull();
  });
});
