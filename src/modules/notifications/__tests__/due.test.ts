import { dueDedupeKey, isDue } from "../due";

const now = new Date("2026-03-10T09:00:00Z");

describe("isDue", () => {
  it("is due once the date has passed", () => {
    expect(isDue({ dueAt: new Date("2026-03-09T00:00:00Z"), completedAt: null }, now)).toBe(true);
  });

  it("is due at the exact moment", () => {
    expect(isDue({ dueAt: now, completedAt: null }, now)).toBe(true);
  });

  it("is not due before the date", () => {
    expect(isDue({ dueAt: new Date("2026-03-11T00:00:00Z"), completedAt: null }, now)).toBe(false);
  });

  it("never nags about something finished", () => {
    const task = { dueAt: new Date("2026-03-01T00:00:00Z"), completedAt: new Date() };
    expect(isDue(task, now)).toBe(false);
  });

  it("never nags about a task with no date", () => {
    // A reminder of something to do isn't a promise about when.
    expect(isDue({ dueAt: null, completedAt: null }, now)).toBe(false);
  });
});

describe("dueDedupeKey", () => {
  it("is the same all day, so one task nags once a day", () => {
    const morning = dueDedupeKey("t1", new Date("2026-03-10T08:00:00Z"));
    const evening = dueDedupeKey("t1", new Date("2026-03-10T21:00:00Z"));
    expect(morning).toBe(evening);
  });

  it("changes the next day, so a week overdue is seven notices at most", () => {
    expect(dueDedupeKey("t1", new Date("2026-03-10T08:00:00Z"))).not.toBe(
      dueDedupeKey("t1", new Date("2026-03-11T08:00:00Z")),
    );
  });

  it("keeps two tasks apart", () => {
    expect(dueDedupeKey("t1", now)).not.toBe(dueDedupeKey("t2", now));
  });
});
