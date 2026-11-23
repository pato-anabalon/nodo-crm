import { nextPingBatch, pingFrom, reactTo, regionJobId, regionsFor, watchFor, type QueuedPing } from "../movement";

describe("reactTo", () => {
  const watch = watchFor("shift", "a");

  it("says nothing about the job they clocked in at until they leave it", () => {
    expect(reactTo(watch, { jobId: "a", entered: true }).reaction).toEqual({});
    const left = reactTo(watch, { jobId: "a", entered: false });
    expect(left.reaction).toEqual({ event: "LEFT" });
    expect(reactTo(left.watch, { jobId: "a", entered: false }).reaction).toEqual({});
    expect(reactTo(left.watch, { jobId: "a", entered: true }).reaction).toEqual({ event: "RETURNED" });
  });

  it("suggests another job on arriving, and takes it back on leaving it again", () => {
    const arrived = reactTo(watch, { jobId: "b", entered: true });
    expect(arrived.reaction).toEqual({ suggest: "b" });
    expect(reactTo(arrived.watch, { jobId: "b", entered: true }).reaction).toEqual({});
    expect(reactTo(arrived.watch, { jobId: "b", entered: false }).reaction).toEqual({ withdraw: "b" });
  });

  it("ignores leaving a job it never saw them enter", () => {
    expect(reactTo(watch, { jobId: "b", entered: false }).reaction).toEqual({});
  });

  it("has no job of its own while travelling", () => {
    expect(reactTo(watchFor("drive", null), { jobId: "a", entered: true }).reaction).toEqual({ suggest: "a" });
  });
});

describe("regionsFor", () => {
  const job = (id: string, latitude: number, radiusM = 300) => ({ id, name: id, address: null, site: { latitude, longitude: 174.76, radiusM } });

  it("puts the shift's own job first, then the nearest, and leaves out the unplaced", () => {
    const jobs = [job("far", -36.9), { id: "none", name: "none", address: null, site: null }, job("near", -36.85), job("own", -36.849)];
    expect(regionsFor(jobs, "own", null).map((region) => regionJobId(region.identifier))).toEqual(["own", "near", "far"]);
  });

  it("orders around where travel was, and never hands over more than twenty", () => {
    const jobs = Array.from({ length: 30 }, (_, i) => job(`j${i}`, -36.8 - i * 0.01));
    const regions = regionsFor(jobs, null, { latitude: -36.8 - 29 * 0.01, longitude: 174.76 });
    expect(regions).toHaveLength(20);
    expect(regionJobId(regions[0].identifier)).toBe("j29");
  });

  it("widens a small circle to what the system can tell", () => {
    expect(regionsFor([job("small", -36.8, 50)], "small", null)[0].radius).toBe(100);
  });
});

it("reads only its own region ids", () => {
  expect(regionJobId("job:abc")).toBe("abc");
  expect(regionJobId("other")).toBeNull();
  expect(regionJobId(undefined)).toBeNull();
});

describe("pings", () => {
  const ping = (entry: string, i: number): QueuedPing => ({ entry, at: `2026-11-14T20:${String(i % 60).padStart(2, "0")}:00.000Z`, latitude: 0, longitude: 0, accuracyM: 10, speedMps: null });

  it("batches one stretch at a time, at most a full batch", () => {
    expect(nextPingBatch([ping("a", 1), ping("a", 2), ping("b", 3), ping("a", 4)])).toHaveLength(2);
    expect(nextPingBatch(Array.from({ length: 600 }, (_, i) => ping("a", i)))).toHaveLength(500);
    expect(nextPingBatch([])).toEqual([]);
  });

  it("drops a speed the phone doesn't know and bounds the accuracy", () => {
    const location = { timestamp: Date.parse("2026-11-14T20:00:00.000Z"), coords: { latitude: 1, longitude: 2, accuracy: null, speed: -1 } };
    expect(pingFrom("a", location)).toEqual({ entry: "a", at: "2026-11-14T20:00:00.000Z", latitude: 1, longitude: 2, accuracyM: 9_999, speedMps: null });
  });
});
