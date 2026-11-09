import { agendaDays } from "../agenda";
import type { ScheduleEvent } from "../types";

const event = (id: string, startsOn: string, endsOn: string, startsAt: string | null = null): ScheduleEvent => ({
  id,
  title: id,
  allDay: startsAt === null,
  milestone: false,
  startsOn,
  endsOn,
  startsAt,
  endsAt: null,
  participants: [],
  comments: 0,
});

const ids = (days: ReturnType<typeof agendaDays>) =>
  days.map(({ day, entries }) => [day, entries.map((entry) => (entry.kind === "event" ? entry.event.id : `todo:${entry.todo.id}`))]);

describe("agendaDays", () => {
  const window = { from: "2026-11-09", to: "2026-12-06" };

  it("lists only the days with something, in order", () => {
    const days = agendaDays({
      ...window,
      events: [event("pour", "2026-11-20", "2026-11-20"), event("scaffold", "2026-11-10", "2026-11-10")],
      todosDue: [{ id: "t1", title: "Order sand", dueOn: "2026-11-12" }],
    });
    expect(ids(days)).toEqual([
      ["2026-11-10", ["scaffold"]],
      ["2026-11-12", ["todo:t1"]],
      ["2026-11-20", ["pour"]],
    ]);
  });

  it("lists an event once, on the first day the window shows, and says when it began before", () => {
    const days = agendaDays({
      ...window,
      events: [event("hire", "2026-11-02", "2026-11-13"), event("cure", "2026-11-15", "2026-11-18")],
      todosDue: [],
    });
    expect(ids(days)).toEqual([
      ["2026-11-09", ["hire"]],
      ["2026-11-15", ["cure"]],
    ]);
    expect(days[0].entries[0]).toMatchObject({ continues: true, multiDay: true });
    expect(days[1].entries[0]).toMatchObject({ continues: false, multiDay: true });
  });

  it("leads the day with all-day things, then timed ones by their start, then to-dos due", () => {
    const days = agendaDays({
      ...window,
      events: [
        event("late", "2026-11-10", "2026-11-10", "2026-11-10T03:00:00Z"),
        event("early", "2026-11-10", "2026-11-10", "2026-11-09T20:00:00Z"),
        event("all day", "2026-11-10", "2026-11-10"),
      ],
      todosDue: [{ id: "t1", title: "Sign off", dueOn: "2026-11-10" }],
    });
    expect(ids(days)).toEqual([["2026-11-10", ["all day", "early", "late", "todo:t1"]]]);
  });

  it("leaves out what falls outside the window", () => {
    const days = agendaDays({
      ...window,
      events: [event("before", "2026-11-01", "2026-11-08"), event("after", "2026-12-07", "2026-12-08")],
      todosDue: [{ id: "t1", title: "x", dueOn: "2026-12-07" }],
    });
    expect(days).toEqual([]);
  });
});
