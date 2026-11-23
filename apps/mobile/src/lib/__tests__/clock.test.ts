import { clockState, elapsedSeconds, jobsNearby, nextBatch, stopwatch, withoutRefused, type OpenEntry, type Punch } from "../clock";

const site = { latitude: -36.8485, longitude: 174.7633, radiusM: 300 };
const north = (metres: number, accuracyM = 15) => ({ latitude: site.latitude + metres / 111_195, longitude: site.longitude, accuracyM });

const open: OpenEntry = {
  id: "e1",
  clientId: "server-shift",
  job: { id: "j1", name: "12 Kegworth Pl" },
  kind: "WORK",
  source: "MOBILE",
  clockInAt: "2026-11-14T19:00:00.000Z",
  clockOutAt: null,
  clockInDistanceM: 40,
  clockOutInside: null,
  endedBy: null,
  clockInLate: false,
  clockOutLate: false,
  note: null,
  edited: false,
  away: null,
  travelEndsAt: null,
};

const clockIn: Punch = { kind: "in", clientId: "phone-shift", jobId: "j2", jobName: "3 Beach Rd", at: "2026-11-14T20:00:00.000Z", fix: north(10), battery: 0.9 };
const clockOut = (entry: string): Punch => ({ kind: "out", entry, at: "2026-11-14T21:00:00.000Z", fix: null, battery: null });

describe("clockState", () => {
  it("is out with nothing open and nothing waiting", () => {
    expect(clockState(null, [])).toEqual({ kind: "out" });
  });

  it("shows the server's open shift", () => {
    expect(clockState(open, [])).toEqual({
      kind: "in",
      entry: "server-shift",
      jobId: "j1",
      jobName: "12 Kegworth Pl",
      since: open.clockInAt,
      pending: false,
      away: null,
    });
  });

  it("shows a clock-in made without signal as in, and waiting", () => {
    expect(clockState(null, [clockIn])).toMatchObject({ kind: "in", entry: "phone-shift", pending: true });
  });

  it("is out once a clock-out is waiting, whether the shift was the server's or the phone's", () => {
    expect(clockState(open, [clockOut("server-shift")])).toEqual({ kind: "out" });
    expect(clockState(null, [clockIn, clockOut("phone-shift")])).toEqual({ kind: "out" });
  });

  it("can't clock out of a shift entered by hand on the web", () => {
    expect(clockState({ ...open, clientId: null, source: "MANUAL" }, [])).toEqual({ kind: "out" });
  });
});

describe("clockState away from the job", () => {
  const policy = { returnMinutes: 20, switchMinutes: 5, travelMaxMinutes: 120 };
  const at = (time: string) => `2026-11-14T${time}:00.000Z`;
  const event = (kind: "LEFT" | "RETURNED" | "ERRAND", time: string): Punch => ({ kind: "event", entry: "server-shift", clientId: `${kind}-${time}`, event: kind, at: at(time) });
  const now = (time: string) => Date.parse(at(time));

  it("counts down from a departure still waiting for signal", () => {
    expect(clockState(open, [event("LEFT", "20:00")], policy, now("20:05"))).toMatchObject({
      kind: "in",
      away: { leftAt: at("20:00"), until: at("20:20"), errand: false },
    });
  });

  it("goes on from the server's own time away, and stops counting on an errand", () => {
    const away = { ...open, away: { leftAt: at("20:00"), until: at("20:20"), errandSince: null } };
    expect(clockState(away, [event("ERRAND", "20:03")], policy, now("20:30"))).toMatchObject({
      kind: "in",
      away: { leftAt: at("20:00"), until: null, errand: true },
    });
  });

  it("is back on the job once the return is queued", () => {
    expect(clockState(open, [event("LEFT", "20:00"), event("RETURNED", "20:10")], policy, now("20:30"))).toMatchObject({ kind: "in", away: null });
  });

  it("reads as ended once the countdown ran out, as the server will settle it", () => {
    expect(clockState(open, [event("LEFT", "20:00")], policy, now("20:21"))).toEqual({ kind: "out" });
  });

  it("starts travel where they left, and a switch ends it on the next job", () => {
    const travel: Punch = { kind: "travel", entry: "server-shift", clientId: "drive", at: at("20:04") };
    expect(clockState(open, [event("LEFT", "20:00"), travel], policy, now("20:10"))).toEqual({
      kind: "travel",
      entry: "drive",
      fromJob: "12 Kegworth Pl",
      since: at("20:00"),
      pending: true,
      endsAt: at("22:00"),
    });
    const arrive: Punch = { kind: "switch", from: "drive", clientId: "next", jobId: "j2", jobName: "3 Beach Rd", at: at("20:30"), fix: north(10), battery: null };
    expect(clockState(open, [event("LEFT", "20:00"), travel, arrive], policy, now("20:31"))).toMatchObject({
      kind: "in",
      entry: "next",
      jobId: "j2",
      since: at("20:30"),
      away: null,
    });
  });

  it("shows the server's travel until its limit", () => {
    const travelling = { ...open, kind: "TRAVEL" as const, job: { id: null, name: "12 Kegworth Pl" }, travelEndsAt: at("21:00") };
    expect(clockState(travelling, [], policy, now("20:30"))).toMatchObject({ kind: "travel", fromJob: "12 Kegworth Pl", endsAt: at("21:00") });
    expect(clockState(travelling, [], policy, now("21:01"))).toEqual({ kind: "out" });
  });
});

describe("jobsNearby", () => {
  const jobs = [
    { id: "far", name: "Far", address: null, site: { ...site, latitude: site.latitude + 0.05 } },
    { id: "none", name: "No place", address: null, site: null },
    { id: "here", name: "Here", address: null, site },
  ];

  it("puts the nearest first and the unplaced last, each with its verdict", () => {
    const sorted = jobsNearby(jobs, north(20));
    expect(sorted.map((job) => job.id)).toEqual(["here", "far", "none"]);
    expect(sorted.map((job) => job.verdict?.kind)).toEqual(["inside", "outside", "no-site"]);
  });

  it("keeps the server's order until there is a fix", () => {
    expect(jobsNearby(jobs, null).map((job) => [job.id, job.verdict])).toEqual([
      ["far", null],
      ["none", null],
      ["here", null],
    ]);
  });
});

it("drops a refused clock-in together with the clock-out that depended on it", () => {
  const other = clockOut("server-shift");
  expect(withoutRefused([other, clockIn, clockOut("phone-shift")], clockIn)).toEqual([other]);
});

it("drops everything that started from a refused punch, all the way down", () => {
  const travel: Punch = { kind: "travel", entry: "phone-shift", clientId: "drive", at: "2026-11-14T20:30:00.000Z" };
  const left: Punch = { kind: "event", entry: "phone-shift", clientId: "left", event: "LEFT", at: "2026-11-14T20:20:00.000Z" };
  const arrive: Punch = { kind: "switch", from: "drive", clientId: "next", jobId: "j3", jobName: "Next", at: "2026-11-14T21:00:00.000Z", fix: north(10), battery: null };
  const unrelated = clockOut("server-shift");
  expect(withoutRefused([clockIn, left, travel, arrive, clockOut("next"), unrelated], clockIn)).toEqual([unrelated]);
});

it("sends a run of events for one shift together, and anything else on its own", () => {
  const event = (entry: string, id: string): Punch => ({ kind: "event", entry, clientId: id, event: "LEFT", at: "2026-11-14T20:00:00.000Z" });
  expect(nextBatch([event("a", "1"), event("a", "2"), event("b", "3")])).toHaveLength(2);
  expect(nextBatch([event("a", "1"), clockIn, event("a", "2")])).toHaveLength(1);
  expect(nextBatch([clockIn, event("a", "1")])).toEqual([clockIn]);
  expect(nextBatch([])).toEqual([]);
});

it("runs a stopwatch from the punch", () => {
  expect(elapsedSeconds("2026-11-14T19:00:00.000Z", Date.parse("2026-11-14T21:05:09.000Z"))).toBe(7509);
  expect(elapsedSeconds("2026-11-14T19:00:00.000Z", Date.parse("2026-11-14T18:59:00.000Z"))).toBe(0);
  expect(stopwatch(7509)).toBe("2:05:09");
});
