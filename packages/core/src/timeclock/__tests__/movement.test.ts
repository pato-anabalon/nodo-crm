import { settlement, siteState, travelDeadline, type MovementPolicy, type SettlingEntry, type SiteEvent } from "../movement";

const policy: MovementPolicy = { returnMinutes: 15, switchMinutes: 5, travelMaxMinutes: 120 };
const at = (time: string) => new Date(`2026-11-18T${time}:00Z`);
const event = (kind: SiteEvent["kind"], time: string): SiteEvent => ({ kind, at: at(time) });

describe("siteState", () => {
  it("counts down from the moment they left, and stops when they come back", () => {
    const away = siteState([event("LEFT", "10:00")], policy, at("10:05"));
    expect(away).toMatchObject({ outside: true, leftAt: at("10:00"), deadline: at("10:15"), endedAt: null });

    const back = siteState([event("LEFT", "10:00"), event("RETURNED", "10:12")], policy, at("10:30"));
    expect(back).toMatchObject({ outside: false, leftAt: null, deadline: null, endedAt: null });
  });

  it("ends the shift at the moment they left once the countdown runs out", () => {
    expect(siteState([event("LEFT", "10:00")], policy, at("10:15")).endedAt).toBeNull();
    expect(siteState([event("LEFT", "10:00")], policy, at("10:16")).endedAt).toEqual(at("10:00"));
  });

  it("doesn't reopen a shift for somebody who came back too late", () => {
    const state = siteState([event("LEFT", "10:00"), event("RETURNED", "10:40")], policy, at("10:41"));
    expect(state.endedAt).toEqual(at("10:00"));
  });

  it("folds events in the order they happened, not the order they arrived", () => {
    const state = siteState([event("RETURNED", "10:10"), event("LEFT", "10:00")], policy, at("11:00"));
    expect(state).toMatchObject({ outside: false, endedAt: null });
  });

  it("keeps the first departure when the phone says it twice", () => {
    const state = siteState([event("LEFT", "10:00"), event("LEFT", "10:10")], policy, at("10:20"));
    expect(state.endedAt).toEqual(at("10:00"));
  });

  it("stops counting during an errand, which closes on coming back", () => {
    const events = [event("LEFT", "10:00"), event("ERRAND", "10:05"), event("RETURNED", "11:30")];
    const state = siteState(events, policy, at("12:00"));
    expect(state).toMatchObject({ outside: false, endedAt: null });
    expect(state.errands).toEqual([{ from: at("10:05"), to: at("11:30") }]);
    expect(siteState(events.slice(0, 2), policy, at("12:00"))).toMatchObject({ outside: true, deadline: null, endedAt: null });
  });

  it("takes an errand declared before leaving", () => {
    const state = siteState([event("ERRAND", "09:58"), event("LEFT", "10:00")], policy, at("12:00"));
    expect(state).toMatchObject({ endedAt: null, errands: [{ from: at("09:58"), to: null }] });
  });

  it("refuses an errand declared after the countdown ran out", () => {
    const state = siteState([event("LEFT", "10:00"), event("ERRAND", "10:20")], policy, at("10:21"));
    expect(state.endedAt).toEqual(at("10:00"));
    expect(state.errands).toEqual([]);
  });

  it("never counts down with the company's countdown off", () => {
    const state = siteState([event("LEFT", "10:00")], { ...policy, returnMinutes: 0 }, at("18:00"));
    expect(state).toMatchObject({ outside: true, deadline: null, endedAt: null });
  });
});

describe("settlement", () => {
  const work = (over: Partial<SettlingEntry> = {}): SettlingEntry => ({
    kind: "WORK",
    clockInAt: at("07:00"),
    clockOutAt: null,
    endedBy: null,
    edited: false,
    ...over,
  });

  it("closes an open shift at the moment they left", () => {
    expect(settlement(work(), [event("LEFT", "10:00")], policy, at("10:30"))).toEqual({
      action: "close",
      at: at("10:00"),
      endedBy: "LEFT_SITE",
    });
    expect(settlement(work(), [event("LEFT", "10:00")], policy, at("10:10"))).toBeNull();
  });

  it("reopens what it closed when a return dated in time arrives late", () => {
    const closed = work({ clockOutAt: at("10:00"), endedBy: "LEFT_SITE" });
    expect(settlement(closed, [event("LEFT", "10:00")], policy, at("11:00"))).toBeNull();
    expect(settlement(closed, [event("LEFT", "10:00"), event("RETURNED", "10:10")], policy, at("11:00"))).toEqual({ action: "reopen" });
  });

  it("moves the end it set when a later departure turns out to be the one", () => {
    const closed = work({ clockOutAt: at("10:00"), endedBy: "LEFT_SITE" });
    const events = [event("LEFT", "10:00"), event("RETURNED", "10:10"), event("LEFT", "12:00")];
    expect(settlement(closed, events, policy, at("13:00"))).toEqual({ action: "close", at: at("12:00"), endedBy: "LEFT_SITE" });
  });

  it("leaves alone what a person ended, or a supervisor corrected", () => {
    const events = [event("LEFT", "10:00")];
    expect(settlement(work({ clockOutAt: at("11:00"), endedBy: "PUNCH" }), events, policy, at("12:00"))).toBeNull();
    expect(settlement(work({ edited: true }), events, policy, at("12:00"))).toBeNull();
    expect(settlement(work({ clockOutAt: at("10:00"), endedBy: "LEFT_SITE", edited: true }), [...events, event("RETURNED", "10:05")], policy, at("12:00"))).toBeNull();
  });

  it("doesn't reopen once the company turned the countdown off", () => {
    const closed = work({ clockOutAt: at("10:00"), endedBy: "LEFT_SITE" });
    const events = [event("LEFT", "10:00"), event("RETURNED", "10:10")];
    expect(settlement(closed, events, { ...policy, returnMinutes: 0 }, at("11:00"))).toBeNull();
  });

  it("ends travel at its limit", () => {
    const travel = work({ kind: "TRAVEL", clockInAt: at("10:00") });
    expect(travelDeadline(at("10:00"), policy)).toEqual(at("12:00"));
    expect(settlement(travel, [], policy, at("11:59"))).toBeNull();
    expect(settlement(travel, [], policy, at("12:01"))).toEqual({ action: "close", at: at("12:00"), endedBy: "TRAVEL_LIMIT" });
  });
});
