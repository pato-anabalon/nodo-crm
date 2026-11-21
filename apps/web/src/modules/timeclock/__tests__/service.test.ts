/** @jest-environment node */
import { Prisma } from "@/generated/prisma/client";
import type { CompanyContext } from "@/lib/auth/session";
import { TimeclockRefusal } from "../errors";
import { clockIn, clockOut, recordPings, setConsent } from "../service";

// Settling — the clock ending a shift by itself — has its own rules, pinned in core; here it never has anything to do.
jest.mock("../settle", () => ({ settleEntry: jest.fn().mockResolvedValue(null) }));

/**
 * The clock's rules against a database that only answers what each case
 * needs. What matters here is the order of the questions — a punch sent twice
 * is answered before anything can refuse it — and that every refusal carries
 * a code the app can say something about.
 */

const now = new Date("2026-11-12T20:00:00Z");
const site = { latitude: -36.8485, longitude: 174.7633, geofenceRadiusM: 300 };
const onSite = { latitude: site.latitude + 100 / 111_195, longitude: site.longitude, accuracyM: 15 };
const away = { latitude: site.latitude + 2000 / 111_195, longitude: site.longitude, accuracyM: 15 };
const job = { id: "j1", name: "12 Kegworth Pl" };

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "e1",
    clientId: "phone-punch-1",
    jobId: "j1",
    jobName: job.name,
    kind: "WORK",
    source: "MOBILE",
    clockInAt: new Date("2026-11-12T19:00:00Z"),
    clockInReceivedAt: new Date("2026-11-12T19:00:01Z"),
    clockInDistanceM: 100,
    clockOutAt: null,
    clockOutReceivedAt: null,
    clockOutInside: null,
    note: null,
    editedAt: null,
    endedBy: null,
    events: [],
    ...overrides,
  };
}

function context() {
  const db = {
    membership: { findFirst: jest.fn(), updateMany: jest.fn() },
    job: { findFirst: jest.fn() },
    timeEntry: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    locationPing: { createMany: jest.fn() },
  };
  const ctx = {
    user: { id: "u1" },
    company: { id: "c1", movementPolicy: { returnMinutes: 0, switchMinutes: 5, travelMaxMinutes: 120 } },
    db,
  } as unknown as CompanyContext;
  return { ctx, db };
}

async function refusal(promise: Promise<unknown>): Promise<TimeclockRefusal> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TimeclockRefusal) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

const punch = (fix = onSite, at = new Date("2026-11-12T19:59:00Z")) => ({ clientId: "phone-punch-1", at, fix, battery: 0.8 });

describe("clockIn", () => {
  function ready() {
    const setup = context();
    setup.db.timeEntry.findFirst.mockResolvedValue(null);
    setup.db.membership.findFirst.mockResolvedValue({ locationConsentAt: new Date("2026-11-01") });
    setup.db.job.findFirst.mockResolvedValue(site);
    setup.db.timeEntry.create.mockImplementation(async ({ data }) => row({ clockInAt: data.clockInAt, clockInReceivedAt: data.clockInReceivedAt }));
    return setup;
  }

  it("clocks in on site with the phone's time, the fix and how far it was", async () => {
    const { ctx, db } = ready();
    const result = await clockIn(ctx, job, punch(), now);
    expect(result.created).toBe(true);
    const data = db.timeEntry.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ jobId: "j1", jobName: job.name, clientId: "phone-punch-1", clockInBattery: 0.8, clockInReceivedAt: now });
    expect(data.clockInAt).toEqual(new Date("2026-11-12T19:59:00Z"));
    expect(data.clockInDistanceM).toBeCloseTo(100, 0);
  });

  it("answers a punch sent again with the shift it made, before anything else", async () => {
    const { ctx, db } = ready();
    db.timeEntry.findFirst.mockResolvedValueOnce(row());
    // Even with consent gone and the phone now far away, a retry finds its shift.
    db.membership.findFirst.mockResolvedValue({ locationConsentAt: null });
    const result = await clockIn(ctx, job, punch(away), now);
    expect(result).toMatchObject({ created: false, entry: { id: "e1", clientId: "phone-punch-1" } });
    expect(db.timeEntry.create).not.toHaveBeenCalled();
  });

  it("refuses before consent", async () => {
    const { ctx, db } = ready();
    db.membership.findFirst.mockResolvedValue({ locationConsentAt: null });
    expect(await refusal(clockIn(ctx, job, punch(), now))).toMatchObject({ code: "consent_required", conflict: true });
  });

  it("refuses away from the job, saying how far and how near it had to be", async () => {
    const { ctx } = ready();
    const refused = await refusal(clockIn(ctx, job, punch(away), now));
    expect(refused).toMatchObject({ code: "outside", conflict: false, extra: { radiusM: 300 } });
    expect(refused.extra.distanceM).toBeGreaterThan(1990);
  });

  it("refuses a job with no place on the map", async () => {
    const { ctx, db } = ready();
    db.job.findFirst.mockResolvedValue({ latitude: null, longitude: null, geofenceRadiusM: 300 });
    expect(await refusal(clockIn(ctx, job, punch(), now))).toMatchObject({ code: "no_site", extra: {} });
  });

  it("refuses a time far ahead of the server's", async () => {
    const { ctx } = ready();
    expect((await refusal(clockIn(ctx, job, punch(onSite, new Date("2026-11-12T21:00:00Z")), now))).code).toBe("punch_in_future");
  });

  it("refuses a second open shift and hands back the one open", async () => {
    const { ctx, db } = ready();
    db.timeEntry.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(row({ id: "open", clientId: "other" }));
    const refused = await refusal(clockIn(ctx, job, punch(), now));
    expect(refused).toMatchObject({ code: "already_clocked_in", conflict: true, extra: { entry: { id: "open" } } });
  });

  it("lets the loser of two racing presses find what the winner made", async () => {
    const { ctx, db } = ready();
    db.timeEntry.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "7" }));
    db.timeEntry.findFirst
      .mockResolvedValueOnce(null) // not sent before
      .mockResolvedValueOnce(null) // nothing open yet
      .mockResolvedValueOnce(row()); // the winner's, by the same id
    expect(await clockIn(ctx, job, punch(), now)).toMatchObject({ created: false, entry: { id: "e1" } });
  });
});

describe("clockOut", () => {
  it("ends the shift where it happened, judged against the job's circle", async () => {
    const { ctx, db } = context();
    db.timeEntry.findFirst.mockResolvedValueOnce({ ...row(), job: site }).mockResolvedValueOnce(row({ clockOutAt: now }));
    db.timeEntry.updateMany.mockResolvedValue({ count: 1 });
    const result = await clockOut(ctx, { entryClientId: "phone-punch-1", at: now, fix: away }, now);
    expect(result.changed).toBe(true);
    const { where, data } = db.timeEntry.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: "e1", clockOutAt: null });
    expect(data).toMatchObject({ clockOutAt: now, clockOutInside: false });
  });

  it("takes a clock-out with no fix, and records nothing about where", async () => {
    const { ctx, db } = context();
    db.timeEntry.findFirst.mockResolvedValueOnce({ ...row(), job: site }).mockResolvedValueOnce(row({ clockOutAt: now }));
    db.timeEntry.updateMany.mockResolvedValue({ count: 1 });
    await clockOut(ctx, { entryClientId: "phone-punch-1", at: now }, now);
    expect(db.timeEntry.updateMany.mock.calls[0][0].data).toMatchObject({ clockOutInside: null, clockOutLatitude: null });
  });

  it("answers a shift already ended as it is, so a retry can't move its end", async () => {
    const { ctx, db } = context();
    db.timeEntry.findFirst.mockResolvedValueOnce({ ...row({ clockOutAt: new Date("2026-11-12T19:30:00Z") }), job: site });
    const result = await clockOut(ctx, { entryClientId: "phone-punch-1", at: now }, now);
    expect(result).toMatchObject({ changed: false, entry: { clockOutAt: "2026-11-12T19:30:00.000Z" } });
    expect(db.timeEntry.updateMany).not.toHaveBeenCalled();
  });

  it("refuses an end before the start, and a shift that isn't this person's", async () => {
    const { ctx, db } = context();
    db.timeEntry.findFirst.mockResolvedValueOnce({ ...row(), job: site });
    expect((await refusal(clockOut(ctx, { entryClientId: "phone-punch-1", at: new Date("2026-11-12T18:00:00Z") }, now))).code).toBe(
      "clock_out_before_in",
    );

    db.timeEntry.findFirst.mockResolvedValueOnce(null);
    expect((await refusal(clockOut(ctx, { entryClientId: "someone-else", at: now }, now))).code).toBe("not_found");
    expect(db.timeEntry.findFirst.mock.calls[1][0].where).toEqual({ clientId: "someone-else", userId: "u1" });
  });
});

describe("recordPings", () => {
  it("keeps what was recorded inside the shift, skipping what is already stored", async () => {
    const { ctx, db } = context();
    db.timeEntry.findFirst.mockResolvedValue({ id: "e1", clockInAt: new Date("2026-11-12T19:00:00Z"), clockOutAt: null });
    db.locationPing.createMany.mockResolvedValue({ count: 1 });
    const fix = { latitude: 1, longitude: 2, accuracyM: 30 };
    const result = await recordPings(
      ctx,
      "phone-punch-1",
      [
        { ...fix, at: new Date("2026-11-12T18:59:00Z") },
        { ...fix, at: new Date("2026-11-12T19:30:00Z") },
      ],
      now,
    );
    expect(result).toEqual({ stored: 1, outside: 1 });
    const call = db.locationPing.createMany.mock.calls[0][0];
    expect(call.skipDuplicates).toBe(true);
    expect(call.data).toEqual([expect.objectContaining({ timeEntryId: "e1", companyId: "c1", recordedAt: new Date("2026-11-12T19:30:00Z") })]);
  });
});

describe("setConsent", () => {
  it("keeps the first date when agreeing again", async () => {
    const { ctx, db } = context();
    const first = new Date("2026-11-01T00:00:00Z");
    db.membership.findFirst.mockResolvedValue({ locationConsentAt: first });
    expect(await setConsent(ctx, true)).toEqual(first);
    expect(db.membership.updateMany).toHaveBeenCalledWith({ where: { userId: "u1" }, data: { locationConsentAt: first } });
  });

  it("won't be withdrawn while a shift is open", async () => {
    const { ctx, db } = context();
    db.timeEntry.findFirst.mockResolvedValue(row());
    expect(await refusal(setConsent(ctx, false))).toMatchObject({ code: "clocked_in", conflict: true });
    expect(db.membership.updateMany).not.toHaveBeenCalled();
  });
});
