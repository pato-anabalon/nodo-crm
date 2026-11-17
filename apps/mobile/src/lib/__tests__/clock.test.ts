import { clockState, elapsedSeconds, jobsNearby, stopwatch, withoutRefused, type ClockEntry, type Punch } from "../clock";

const site = { latitude: -36.8485, longitude: 174.7633, radiusM: 300 };
const north = (metres: number, accuracyM = 15) => ({ latitude: site.latitude + metres / 111_195, longitude: site.longitude, accuracyM });

const open: ClockEntry = {
  id: "e1",
  clientId: "server-shift",
  job: { id: "j1", name: "12 Kegworth Pl" },
  source: "MOBILE",
  clockInAt: "2026-11-14T19:00:00.000Z",
  clockOutAt: null,
  clockInDistanceM: 40,
  clockOutInside: null,
  clockInLate: false,
  clockOutLate: false,
  note: null,
  edited: false,
};

const clockIn: Punch = { kind: "in", clientId: "phone-shift", jobId: "j2", jobName: "3 Beach Rd", at: "2026-11-14T20:00:00.000Z", fix: north(10), battery: 0.9 };
const clockOut = (entry: string): Punch => ({ kind: "out", entry, at: "2026-11-14T21:00:00.000Z", fix: null, battery: null });

describe("clockState", () => {
  it("is out with nothing open and nothing waiting", () => {
    expect(clockState(null, [])).toEqual({ kind: "out" });
  });

  it("shows the server's open shift", () => {
    expect(clockState(open, [])).toEqual({ kind: "in", entry: "server-shift", jobName: "12 Kegworth Pl", since: open.clockInAt, pending: false });
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

it("runs a stopwatch from the punch", () => {
  expect(elapsedSeconds("2026-11-14T19:00:00.000Z", Date.parse("2026-11-14T21:05:09.000Z"))).toBe(7509);
  expect(elapsedSeconds("2026-11-14T19:00:00.000Z", Date.parse("2026-11-14T18:59:00.000Z"))).toBe(0);
  expect(stopwatch(7509)).toBe("2:05:09");
});
