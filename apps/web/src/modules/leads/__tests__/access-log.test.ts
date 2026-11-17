import { VIEW_WINDOW_MS, changedLeadFields, isNewVisit } from "../access-log";

describe("isNewVisit", () => {
  const now = new Date("2026-10-27T10:00:00Z");

  it("is a visit when the person has none on record", () => {
    expect(isNewVisit(null, now)).toBe(true);
  });

  it("is the same visit inside the window", () => {
    expect(isNewVisit(new Date(now.getTime() - VIEW_WINDOW_MS + 1000), now)).toBe(false);
  });

  it("is a new visit once the window has passed", () => {
    expect(isNewVisit(new Date(now.getTime() - VIEW_WINDOW_MS), now)).toBe(true);
  });
});

describe("changedLeadFields", () => {
  it("names only the fields that changed", () => {
    expect(
      changedLeadFields(
        { title: "Roof", contactPhone: "021", score: 10 },
        { title: "Roof", contactPhone: "022", score: 10 },
      ),
    ).toEqual(["contactPhone"]);
  });

  it("treats null, undefined and empty as the same nothing", () => {
    expect(changedLeadFields({ description: null }, { description: "" })).toEqual([]);
  });

  it("compares a Decimal against the number the form posts by their text", () => {
    const stored = { toString: () => "100" };
    expect(changedLeadFields({ estimatedValue: stored }, { estimatedValue: 100 })).toEqual([]);
    expect(changedLeadFields({ estimatedValue: stored }, { estimatedValue: 120 })).toEqual(["estimatedValue"]);
  });
});
