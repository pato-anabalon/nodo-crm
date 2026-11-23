/** @jest-environment node */
import { notifyLeftOpen } from "../notices";

/**
 * Who hears about a shift left open, and with what. The threshold itself is
 * pinned in core (`isLeftOpen`); here, that travel isn't asked about, and that
 * the person and every supervisor get one notice each, keyed to the shift.
 */

const notify = jest.fn().mockResolvedValue(true);
const db = {
  timeEntry: { findMany: jest.fn(), findUnique: jest.fn() },
  membership: { findMany: jest.fn() },
};
jest.mock("@/lib/db/prisma", () => ({
  get prisma() {
    return db;
  },
}));
jest.mock("@/modules/notifications/inbox", () => ({ notify: (input: unknown) => notify(input) }));

const now = new Date("2026-11-21T19:00:00Z");

beforeEach(() => jest.clearAllMocks());

it("asks only about open shifts on a job, opened long enough ago", async () => {
  db.timeEntry.findMany.mockResolvedValue([]);
  await notifyLeftOpen(now);
  const where = db.timeEntry.findMany.mock.calls[0][0].where;
  expect(where).toMatchObject({ clockOutAt: null, kind: "WORK" });
  expect(where.clockInAt.lte).toEqual(new Date("2026-11-21T05:00:00Z"));
});

it("tells the person and each supervisor once, keyed to the shift", async () => {
  db.timeEntry.findMany.mockResolvedValue([{ id: "e1" }]);
  db.timeEntry.findUnique.mockResolvedValue({
    id: "e1",
    companyId: "c1",
    userId: "worker",
    jobName: "12 Kegworth Pl",
    clockInAt: new Date("2026-11-20T19:30:00Z"),
    clockOutAt: null,
    endedBy: null,
    user: { name: "Ana", email: "ana@example.com" },
    company: { timezone: "Pacific/Auckland" },
  });
  // The worker can read everybody's hours too: still one notice.
  db.membership.findMany.mockResolvedValue([{ userId: "boss" }, { userId: "worker" }]);

  expect(await notifyLeftOpen(now)).toBe(1);
  expect(notify).toHaveBeenCalledTimes(2);
  expect(notify).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: "worker",
      kind: "TIMECLOCK_LEFT_OPEN",
      params: { person: "Ana", job: "12 Kegworth Pl", hours: 23, self: "yes" },
      href: "/timesheets/worker/shifts/e1",
      dedupeKey: "timeclock-left-open:e1",
    }),
  );
  expect(notify).toHaveBeenCalledWith(expect.objectContaining({ userId: "boss", params: expect.objectContaining({ self: "no" }) }));
});

it("says nothing about a shift that closed in the meantime", async () => {
  db.timeEntry.findMany.mockResolvedValue([{ id: "e1" }]);
  db.timeEntry.findUnique.mockResolvedValue({
    id: "e1",
    companyId: "c1",
    userId: "worker",
    jobName: "x",
    clockInAt: new Date("2026-11-20T19:30:00Z"),
    clockOutAt: new Date("2026-11-21T04:00:00Z"),
    endedBy: "PUNCH",
    user: { name: "Ana", email: "ana@example.com" },
    company: { timezone: "Pacific/Auckland" },
  });
  expect(await notifyLeftOpen(now)).toBe(0);
  expect(notify).not.toHaveBeenCalled();
});
