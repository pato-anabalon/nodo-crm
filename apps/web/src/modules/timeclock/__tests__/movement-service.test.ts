/** @jest-environment node */
import type { CompanyContext } from "@/lib/auth/session";
import { TimeclockRefusal } from "../errors";
import { recordSiteEvents, startTravel, switchSite } from "../movement-service";

/**
 * Moving during a shift against a database that answers only what each case
 * asks. The rules of when a shift ends by itself are pinned in core
 * (`movement.test.ts`); what is pinned here is what each call writes, and
 * that travel and a switch end what was open in the same transaction as they
 * start the next stretch.
 */

const tx = { timeEntry: { updateMany: jest.fn(), create: jest.fn() } };
jest.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: (run: (client: unknown) => unknown) => run(tx) } }));
jest.mock("../settle", () => ({ settleEntry: jest.fn().mockResolvedValue(null) }));

const now = new Date("2026-11-18T22:00:00Z");
const policy = { returnMinutes: 15, switchMinutes: 5, travelMaxMinutes: 120 };
const site = { latitude: -36.8485, longitude: 174.7633, geofenceRadiusM: 300 };
const onSite = { latitude: site.latitude + 50 / 111_195, longitude: site.longitude, accuracyM: 10 };

function shift(overrides: Record<string, unknown> = {}) {
  return {
    id: "e1",
    clientId: "shift-on-a-1",
    kind: "WORK",
    jobId: "a",
    jobName: "12 Kegworth Pl",
    source: "MOBILE",
    clockInAt: new Date("2026-11-18T19:00:00Z"),
    clockInReceivedAt: new Date("2026-11-18T19:00:00Z"),
    clockInDistanceM: 40,
    clockOutAt: null,
    clockOutReceivedAt: null,
    clockOutInside: null,
    endedBy: null,
    note: null,
    editedAt: null,
    events: [],
    ...overrides,
  };
}

function context() {
  const db = {
    membership: { findFirst: jest.fn().mockResolvedValue({ locationConsentAt: new Date("2026-11-01") }) },
    job: { findFirst: jest.fn().mockResolvedValue(site) },
    timeEntry: { findFirst: jest.fn() },
    timeEntryEvent: { createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  };
  const ctx = { user: { id: "u1" }, company: { id: "c1", movementPolicy: policy }, db } as unknown as CompanyContext;
  return { ctx, db };
}

/** Answers `findFirst` by what it is asked for: a `clientId`, or the open shift. */
function entries(db: ReturnType<typeof context>["db"], byClientId: Record<string, unknown>, open: unknown = null) {
  db.timeEntry.findFirst.mockImplementation(async ({ where }: { where: { clientId?: string; clockOutAt?: null } }) =>
    where.clientId ? (byClientId[where.clientId] ?? null) : open,
  );
}

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TimeclockRefusal) return error.code;
    throw error;
  }
  throw new Error("expected a refusal");
}

beforeEach(() => {
  tx.timeEntry.updateMany.mockReset().mockResolvedValue({ count: 1 });
  tx.timeEntry.create.mockReset().mockImplementation(async ({ data }) => shift({ ...data, id: "next", events: undefined }));
});

describe("recordSiteEvents", () => {
  it("keeps what happened during the shift and drops what no punch could be", async () => {
    const { ctx, db } = context();
    entries(db, { "shift-on-a-1": shift() });
    db.timeEntryEvent.createMany.mockResolvedValue({ count: 1 });

    await recordSiteEvents(
      ctx,
      "shift-on-a-1",
      [
        { clientId: "ev-before", kind: "LEFT", at: new Date("2026-11-18T18:00:00Z") },
        { clientId: "ev-left-1", kind: "LEFT", at: new Date("2026-11-18T21:00:00Z") },
        { clientId: "ev-future", kind: "RETURNED", at: new Date("2026-11-18T23:00:00Z") },
      ],
      now,
    );
    const { data } = db.timeEntryEvent.createMany.mock.calls[0][0];
    expect(data.map((event: { clientId: string }) => event.clientId)).toEqual(["ev-left-1"]);
  });

  it("keeps an errand's words and nobody else's", async () => {
    const { ctx, db } = context();
    entries(db, { "shift-on-a-1": shift() });
    db.timeEntryEvent.createMany.mockResolvedValue({ count: 2 });

    await recordSiteEvents(
      ctx,
      "shift-on-a-1",
      [
        { clientId: "ev-errand", kind: "ERRAND", at: new Date("2026-11-18T21:00:00Z"), note: "  Materials from Placemakers " },
        { clientId: "ev-back-1", kind: "RETURNED", at: new Date("2026-11-18T21:30:00Z"), note: "ignored" },
      ],
      now,
    );
    const { data } = db.timeEntryEvent.createMany.mock.calls[0][0];
    expect(data.map((event: { note: string | null }) => event.note)).toEqual(["Materials from Placemakers", null]);
  });

  it("takes a late return for a shift the clock closed, and nothing for one a person ended", async () => {
    const { ctx, db } = context();
    const late = { clientId: "ev-back-1", kind: "RETURNED" as const, at: new Date("2026-11-18T21:10:00Z") };
    db.timeEntryEvent.createMany.mockResolvedValue({ count: 1 });

    entries(db, { "shift-on-a-1": shift({ clockOutAt: new Date("2026-11-18T21:00:00Z"), endedBy: "LEFT_SITE" }) });
    await recordSiteEvents(ctx, "shift-on-a-1", [late], now);
    expect(db.timeEntryEvent.createMany.mock.calls[0][0].data).toHaveLength(1);

    entries(db, { "shift-on-a-1": shift({ clockOutAt: new Date("2026-11-18T21:00:00Z"), endedBy: "PUNCH" }) });
    await recordSiteEvents(ctx, "shift-on-a-1", [late], now);
    expect(db.timeEntryEvent.createMany.mock.calls[1][0].data).toHaveLength(0);
  });
});

describe("startTravel", () => {
  it("ends the shift at the moment they left and starts travel there, on no job", async () => {
    const { ctx, db } = context();
    entries(db, { "shift-on-a-1": shift() });
    db.timeEntryEvent.findMany.mockResolvedValue([{ kind: "LEFT", at: new Date("2026-11-18T21:40:00Z") }]);

    const { entry, created } = await startTravel(ctx, { entryClientId: "shift-on-a-1", clientId: "travel-1x", at: now }, now);
    expect(created).toBe(true);
    expect(tx.timeEntry.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", companyId: "c1", clockOutAt: null },
      data: { clockOutAt: new Date("2026-11-18T21:40:00Z"), clockOutReceivedAt: now, endedBy: "SWITCHED" },
    });
    expect(tx.timeEntry.create.mock.calls[0][0].data).toMatchObject({
      kind: "TRAVEL",
      jobId: null,
      jobName: "12 Kegworth Pl",
      clockInAt: new Date("2026-11-18T21:40:00Z"),
    });
    expect(entry.kind).toBe("TRAVEL");
  });

  it("starts where the clock ended a shift for being away, and marks it switched from", async () => {
    const { ctx, db } = context();
    entries(db, { "shift-on-a-1": shift({ clockOutAt: new Date("2026-11-18T21:00:00Z"), endedBy: "LEFT_SITE" }) });

    await startTravel(ctx, { entryClientId: "shift-on-a-1", clientId: "travel-1x", at: now }, now);
    expect(tx.timeEntry.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", companyId: "c1", endedBy: "LEFT_SITE", editedAt: null },
      data: { endedBy: "SWITCHED" },
    });
    expect(tx.timeEntry.create.mock.calls[0][0].data.clockInAt).toEqual(new Date("2026-11-18T21:00:00Z"));
  });

  it("refuses after a shift somebody ended, and answers a resend with what it made", async () => {
    const { ctx, db } = context();
    entries(db, { "shift-on-a-1": shift({ clockOutAt: new Date("2026-11-18T21:00:00Z"), endedBy: "PUNCH" }) });
    expect(await refusal(startTravel(ctx, { entryClientId: "shift-on-a-1", clientId: "travel-1x", at: now }, now))).toBe("already_ended");

    entries(db, { "travel-1x": shift({ clientId: "travel-1x", kind: "TRAVEL", jobId: null }) });
    const again = await startTravel(ctx, { entryClientId: "shift-on-a-1", clientId: "travel-1x", at: now }, now);
    expect(again.created).toBe(false);
    expect(tx.timeEntry.create).not.toHaveBeenCalled();
  });
});

describe("switchSite", () => {
  const job = { id: "b", name: "4 Ponsonby Rd" };

  it("ends the travel and starts the shift on the new job at the same instant", async () => {
    const { ctx, db } = context();
    entries(db, { "travel-1x": shift({ id: "t1", clientId: "travel-1x", kind: "TRAVEL", jobId: null }) });

    await switchSite(ctx, job, { fromClientId: "travel-1x", clientId: "shift-on-b-1", at: now, fix: onSite }, now);
    expect(tx.timeEntry.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "t1", clockOutAt: null }, data: { clockOutAt: now, endedBy: "SWITCHED" } });
    expect(tx.timeEntry.create.mock.calls[0][0].data).toMatchObject({ kind: "WORK", jobId: "b", jobName: "4 Ponsonby Rd", clockInAt: now });
  });

  it("is held to what a clock-in is, and won't switch to the job already open", async () => {
    const { ctx, db } = context();
    entries(db, { "shift-on-a-1": shift() });
    const away = { ...onSite, latitude: site.latitude + 2000 / 111_195 };
    expect(await refusal(switchSite(ctx, job, { fromClientId: "shift-on-a-1", clientId: "shift-on-b-1", at: now, fix: away }, now))).toBe("outside");
    expect(await refusal(switchSite(ctx, { id: "a", name: "12 Kegworth Pl" }, { fromClientId: "shift-on-a-1", clientId: "shift-on-a-2", at: now, fix: onSite }, now))).toBe("same_job");
    expect(tx.timeEntry.create).not.toHaveBeenCalled();
  });

  it("clocks in after a shift the clock already ended, closing nothing", async () => {
    const { ctx, db } = context();
    entries(db, { "shift-on-a-1": shift({ clockOutAt: new Date("2026-11-18T21:00:00Z"), endedBy: "LEFT_SITE" }) });

    await switchSite(ctx, job, { fromClientId: "shift-on-a-1", clientId: "shift-on-b-1", at: now, fix: onSite }, now);
    expect(tx.timeEntry.updateMany).not.toHaveBeenCalled();
    expect(tx.timeEntry.create).toHaveBeenCalled();
  });
});
