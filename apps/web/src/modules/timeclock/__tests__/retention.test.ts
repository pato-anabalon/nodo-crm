/** @jest-environment node */
import { decodeTrack, encodeTrack } from "@nodo/core/timeclock/track";
import { thinOldTracks } from "../retention";

/**
 * Thinning old positions against a database that answers only what each case
 * asks. What is pinned: which shifts are asked for, that the line written
 * covers the positions it replaces, and that writing it and deleting them
 * are one transaction.
 */

const db = {
  timeEntry: { findMany: jest.fn(), update: jest.fn((args) => ({ op: "update", args })) },
  locationPing: { findMany: jest.fn(), deleteMany: jest.fn((args) => ({ op: "delete", args })) },
  $transaction: jest.fn(),
};
jest.mock("@/lib/db/prisma", () => ({
  get prisma() {
    return db;
  },
}));

const now = new Date("2026-11-21T19:00:00Z");
const company = { id: "c1", locationRetentionDays: 180 };

beforeEach(() => jest.clearAllMocks());

it("asks only for closed shifts that began before the retention, with positions left", async () => {
  db.timeEntry.findMany.mockResolvedValue([]);
  await thinOldTracks(company, now);
  const where = db.timeEntry.findMany.mock.calls[0][0].where;
  expect(where).toMatchObject({ companyId: "c1", clockOutAt: { not: null }, pings: { some: {} } });
  expect(where.clockInAt.lt).toEqual(new Date("2026-05-25T19:00:00Z"));
});

it("writes the line and deletes the positions in one transaction", async () => {
  db.timeEntry.findMany.mockResolvedValue([{ id: "e1", track: null }]);
  db.locationPing.findMany.mockResolvedValue([
    { latitude: -36.85, longitude: 174.76 },
    { latitude: -36.851, longitude: 174.76 },
    { latitude: -36.852, longitude: 174.76 },
  ]);

  expect(await thinOldTracks(company, now)).toBe(1);
  const [update, remove] = db.$transaction.mock.calls[0][0];
  expect(remove.args).toEqual({ where: { timeEntryId: "e1" } });
  const line = decodeTrack(update.args.data.track);
  expect(line[0]).toEqual({ latitude: -36.85, longitude: 174.76 });
  expect(line.at(-1)).toEqual({ latitude: -36.852, longitude: 174.76 });
});

it("keeps a line an earlier run wrote, ahead of what came after", async () => {
  db.timeEntry.findMany.mockResolvedValue([{ id: "e1", track: encodeTrack([{ latitude: -36.85, longitude: 174.76 }]) }]);
  db.locationPing.findMany.mockResolvedValue([{ latitude: -36.9, longitude: 174.9 }]);
  await thinOldTracks(company, now);
  const [update] = db.$transaction.mock.calls[0][0];
  const line = decodeTrack(update.args.data.track);
  expect(line).toHaveLength(2);
  expect(line[1]).toEqual({ latitude: -36.9, longitude: 174.9 });
});
