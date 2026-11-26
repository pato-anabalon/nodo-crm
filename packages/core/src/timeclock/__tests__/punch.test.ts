import {
  clockInRefusal,
  isLatePunch,
  isLeftOpen,
  punchTimeProblem,
  trackEnd,
  withinShift,
  LEFT_OPEN_AFTER_MS,
  PUNCH_FUTURE_TOLERANCE_MS,
  PUNCH_MAX_AGE_MS,
} from "../punch";

const now = new Date("2026-11-12T20:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const site = { latitude: -36.8485, longitude: 174.7633 };
// About 111 m north per 0.001° of latitude.
const north = (metres: number, accuracyM: number) => ({ latitude: site.latitude + metres / 111_195, longitude: site.longitude, accuracyM });

describe("punchTimeProblem", () => {
  it("keeps a punch made a moment ago, or one sent days later without signal", () => {
    expect(punchTimeProblem(ago(1000), now)).toBeNull();
    expect(punchTimeProblem(ago(3 * 24 * 60 * 60_000), now)).toBeNull();
  });

  it("forgives a phone clock a little ahead, not a lot", () => {
    expect(punchTimeProblem(ago(-PUNCH_FUTURE_TOLERANCE_MS), now)).toBeNull();
    expect(punchTimeProblem(ago(-PUNCH_FUTURE_TOLERANCE_MS - 1), now)).toBe("punch_in_future");
  });

  it("refuses a punch older than a week", () => {
    expect(punchTimeProblem(ago(PUNCH_MAX_AGE_MS), now)).toBeNull();
    expect(punchTimeProblem(ago(PUNCH_MAX_AGE_MS + 1), now)).toBe("punch_too_old");
  });
});

it("calls a punch late only when it took more than ten minutes to arrive", () => {
  expect(isLatePunch(ago(10 * 60_000), now)).toBe(false);
  expect(isLatePunch(ago(10 * 60_000 + 1), now)).toBe(true);
});

describe("clockInRefusal", () => {
  it("takes a punch on site and says how far it was", () => {
    const answer = clockInRefusal(site, 300, north(120, 20));
    expect(answer.refusal).toBeNull();
    expect(answer.distanceM).toBeCloseTo(120, 0);
  });

  it("refuses away from the job, a vague guess, and a job with no place", () => {
    expect(clockInRefusal(site, 300, north(900, 20)).refusal).toBe("outside");
    expect(clockInRefusal(site, 300, north(500, 400)).refusal).toBe("imprecise");
    expect(clockInRefusal(null, 300, north(0, 5))).toEqual({ refusal: "no_site" });
  });
});

describe("withinShift", () => {
  const clockIn = ago(60 * 60_000);
  const pings = [ago(2 * 60 * 60_000), ago(30 * 60_000), ago(-1000), ago(-10 * 60_000)].map((at) => ({ at }));

  it("keeps what an open shift recorded, up to a clock's drift ahead", () => {
    expect(withinShift(pings, clockIn, null, now).map((ping) => ping.at)).toEqual([ago(30 * 60_000), ago(-1000)]);
  });

  it("stops at the clock-out for a batch that arrives after it", () => {
    expect(withinShift(pings, clockIn, ago(10 * 60_000), now).map((ping) => ping.at)).toEqual([ago(30 * 60_000)]);
  });
});

describe("isLeftOpen", () => {
  it("lets a long day run, and calls one past the limit left open", () => {
    expect(isLeftOpen(ago(10 * 60 * 60_000), now)).toBe(false);
    expect(isLeftOpen(ago(LEFT_OPEN_AFTER_MS - 1), now)).toBe(false);
    expect(isLeftOpen(ago(LEFT_OPEN_AFTER_MS), now)).toBe(true);
  });
});

describe("trackEnd", () => {
  const left = ago(60 * 60_000);

  it("stops at the clock-out a person pressed, or a switch made", () => {
    expect(trackEnd(left, "PUNCH", 15)).toEqual(left);
    expect(trackEnd(left, "SWITCHED", 15)).toEqual(left);
  });

  it("keeps where they went until the countdown ran out, for a shift the clock ended at the departure", () => {
    expect(trackEnd(left, "LEFT_SITE", 15)).toEqual(ago(45 * 60_000));
  });

  it("has no end while the shift is open", () => {
    expect(trackEnd(null, null, 15)).toBeNull();
  });
});
