import { FLUSH_AT_QUEUED, MOVING_SPEED_MPS, samplingFor, shouldFlush } from "../sampling";

describe("samplingFor", () => {
  it("asks often on the move, and no more often on the job than away", () => {
    const onSite = samplingFor({ inside: true, speedMps: 0.3 });
    const moving = samplingFor({ inside: false, speedMps: 15 });
    const away = samplingFor({ inside: false, speedMps: 0 });
    expect(onSite.mode).toBe("still_on_site");
    expect(moving.mode).toBe("moving");
    expect(away.mode).toBe("still_away");
    expect(onSite.intervalMs).toBeGreaterThanOrEqual(away.intervalMs);
    // How late a departure can be read from the track when the system's geofencing is slow to say so.
    expect(onSite.intervalMs).toBeLessThanOrEqual(5 * 60_000);
    expect(away.intervalMs).toBeGreaterThan(moving.intervalMs);
  });

  it("doesn't read walking around the site as leaving it", () => {
    expect(samplingFor({ inside: true, speedMps: 1.4 }).mode).toBe("still_on_site");
    expect(samplingFor({ inside: true, speedMps: MOVING_SPEED_MPS }).mode).toBe("moving");
  });

  it("reads a fix with no speed as still", () => {
    expect(samplingFor({ inside: false, speedMps: null }).mode).toBe("still_away");
  });

  it("never asks for high precision", () => {
    expect(samplingFor({ inside: false, speedMps: 20 }).accuracy).toBe("balanced");
  });
});

describe("shouldFlush", () => {
  const now = new Date("2026-11-21T10:00:00Z");
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

  it("waits while the queue is short and fresh", () => {
    expect(shouldFlush({ queued: 5, oldestQueuedAt: minutesAgo(10), now, clockingOut: false })).toBe(false);
  });

  it("sends once the oldest has waited long enough, or the queue grew", () => {
    expect(shouldFlush({ queued: 5, oldestQueuedAt: minutesAgo(20), now, clockingOut: false })).toBe(true);
    expect(shouldFlush({ queued: FLUSH_AT_QUEUED, oldestQueuedAt: minutesAgo(1), now, clockingOut: false })).toBe(true);
  });

  it("always sends at clock-out, and never with nothing queued", () => {
    expect(shouldFlush({ queued: 1, oldestQueuedAt: minutesAgo(0), now, clockingOut: true })).toBe(true);
    expect(shouldFlush({ queued: 0, oldestQueuedAt: null, now, clockingOut: true })).toBe(false);
  });
});
