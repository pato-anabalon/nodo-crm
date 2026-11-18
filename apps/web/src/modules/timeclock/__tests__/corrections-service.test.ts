/** @jest-environment node */
import { Prisma } from "@/generated/prisma/client";
import type { CompanyContext } from "@/lib/auth/session";
import { shiftWindow } from "../corrections";
import { addShift, adjustMeal, correctShift, deleteShift } from "../corrections-service";
import { TimeclockRefusal } from "../errors";

/**
 * A supervisor's hand on somebody's hours, against a database that answers
 * only what each case needs. What matters: nobody touches their own hours,
 * a change never lands without its line in the log, and what the log keeps is
 * what the shift was before.
 */

jest.mock("@/lib/db/prisma", () => {
  const tx = {
    timeEntry: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    timesheetChange: { create: jest.fn() },
    timesheetDay: { upsert: jest.fn(), delete: jest.fn() },
  };
  return {
    prisma: {
      ...tx,
      $transaction: jest.fn(async (arg: unknown) => (typeof arg === "function" ? arg(tx) : Promise.all(arg as unknown[]))),
    },
  };
});

const { prisma: tx } = jest.requireMock<{
  prisma: {
    timeEntry: Record<"create" | "update" | "delete", jest.Mock>;
    timesheetChange: Record<"create", jest.Mock>;
    timesheetDay: Record<"upsert" | "delete", jest.Mock>;
  };
}>("@/lib/db/prisma");

const zone = "Pacific/Auckland";
const now = new Date("2026-11-17T04:00:00Z");
const window = shiftWindow("2026-11-16", "07:30", "16:00", zone);

function context() {
  const db = {
    membership: { findFirst: jest.fn().mockResolvedValue({ id: "m2" }) },
    job: { findFirst: jest.fn().mockResolvedValue({ id: "j2", name: "25A Fairclough Rd" }) },
    timeEntry: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    timesheetDay: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const ctx = { user: { id: "boss" }, company: { id: "c1", timezone: zone }, db } as unknown as CompanyContext;
  return { ctx, db };
}

const entry = {
  id: "e1",
  userId: "worker",
  jobId: "j1",
  jobName: "9 Thornhill Pl",
  clockInAt: new Date("2026-11-15T18:30:00Z"),
  clockOutAt: null as Date | null,
};

async function refusal(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(TimeclockRefusal);
  return (error as TimeclockRefusal).code;
}

beforeEach(() => {
  jest.clearAllMocks();
  tx.timeEntry.create.mockResolvedValue({ id: "new" });
});

describe("addShift", () => {
  it("enters a shift by hand with its line in the log", async () => {
    const { ctx } = context();
    await expect(addShift(ctx, "worker", { jobId: "j2", window, reason: "Phone died" }, now)).resolves.toBe("new");
    expect(tx.timeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: "c1", userId: "worker", source: "MANUAL", jobName: "25A Fairclough Rd", createdById: "boss" }),
      }),
    );
    expect(tx.timesheetChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "SHIFT_ADDED", timeEntryId: "new", reason: "Phone died", authorId: "boss", day: new Date("2026-11-16T00:00:00Z") }),
    });
  });

  it("refuses one's own hours before anything else", async () => {
    const { ctx, db } = context();
    expect(await refusal(addShift(ctx, "boss", { jobId: "j2", window, reason: "x" }, now))).toBe("own_hours");
    expect(db.job.findFirst).not.toHaveBeenCalled();
  });

  it("refuses somebody who isn't in the company", async () => {
    const { ctx, db } = context();
    db.membership.findFirst.mockResolvedValue(null);
    expect(await refusal(addShift(ctx, "stranger", { jobId: "j2", window, reason: "x" }, now))).toBe("not_found");
  });

  it("refuses a shift over another of theirs", async () => {
    const { ctx, db } = context();
    db.timeEntry.findMany.mockResolvedValue([{ clockInAt: window.clockInAt, clockOutAt: window.clockOutAt }]);
    expect(await refusal(addShift(ctx, "worker", { jobId: "j2", window, reason: "x" }, now))).toBe("overlaps");
    expect(tx.timeEntry.create).not.toHaveBeenCalled();
  });

  it("answers a second open shift raced in as an overlap", async () => {
    const { ctx } = context();
    tx.timeEntry.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "7" }));
    expect(await refusal(addShift(ctx, "worker", { jobId: "j2", window: { ...window, clockOutAt: null }, reason: "x" }, now))).toBe("overlaps");
  });
});

describe("correctShift", () => {
  it("closes a forgotten clock-out, keeping what it was", async () => {
    const { ctx, db } = context();
    db.timeEntry.findFirst.mockResolvedValue(entry);
    await correctShift(ctx, "e1", { jobId: "j1", window, reason: "Forgot to clock out" }, now);

    expect(tx.timeEntry.update).toHaveBeenCalledWith({
      where: { id: "e1", companyId: "c1" },
      data: expect.objectContaining({ jobName: "9 Thornhill Pl", clockOutAt: window.clockOutAt, clockOutReceivedAt: now, editedById: "boss", editedAt: now }),
    });
    expect(tx.timesheetChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "SHIFT_CORRECTED",
        before: { jobName: "9 Thornhill Pl", clockInAt: "2026-11-15T18:30:00.000Z", clockOutAt: null },
        after: { jobName: "9 Thornhill Pl", clockInAt: "2026-11-15T18:30:00.000Z", clockOutAt: "2026-11-16T03:00:00.000Z" },
      }),
    });
    // The job wasn't changed, so its name wasn't looked up again.
    expect(db.job.findFirst).not.toHaveBeenCalled();
  });

  it("checks the overlap against the person's other shifts, not this one", async () => {
    const { ctx, db } = context();
    db.timeEntry.findFirst.mockResolvedValue(entry);
    await correctShift(ctx, "e1", { jobId: "j1", window, reason: "x" }, now);
    expect(db.timeEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "worker", id: { not: "e1" } }) }));
  });

  it("won't reopen a shift that ended", async () => {
    const { ctx, db } = context();
    db.timeEntry.findFirst.mockResolvedValue({ ...entry, clockOutAt: window.clockOutAt });
    expect(await refusal(correctShift(ctx, "e1", { jobId: "j1", window: { ...window, clockOutAt: null }, reason: "x" }, now))).toBe("reopen");
  });

  it("refuses one's own shift", async () => {
    const { ctx, db } = context();
    db.timeEntry.findFirst.mockResolvedValue({ ...entry, userId: "boss" });
    expect(await refusal(correctShift(ctx, "e1", { jobId: "j1", window, reason: "x" }, now))).toBe("own_hours");
  });

  it("writes nothing when nothing changed", async () => {
    const { ctx, db } = context();
    db.timeEntry.findFirst.mockResolvedValue({ ...entry, clockOutAt: window.clockOutAt });
    await correctShift(ctx, "e1", { jobId: "j1", window, reason: "x" }, now);
    expect(tx.timesheetChange.create).not.toHaveBeenCalled();
  });
});

it("keeps a deleted shift's line, with what it was", async () => {
  const { ctx, db } = context();
  db.timeEntry.findFirst.mockResolvedValue({ ...entry, clockOutAt: window.clockOutAt });
  await expect(deleteShift(ctx, "e1", "Clocked in twice")).resolves.toBe("worker");
  expect(tx.timesheetChange.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ kind: "SHIFT_DELETED", reason: "Clocked in twice", before: expect.objectContaining({ jobName: "9 Thornhill Pl" }) }),
  });
  expect(tx.timeEntry.delete).toHaveBeenCalledWith({ where: { id: "e1", companyId: "c1" } });
});

describe("adjustMeal", () => {
  it("sets a day's meal break and logs it", async () => {
    const { ctx } = context();
    await adjustMeal(ctx, "worker", "2026-11-16", 60, "Dentist at lunch");
    expect(tx.timesheetDay.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ mealBreakMinutes: 60, reason: "Dentist at lunch", day: new Date("2026-11-16T00:00:00Z") }) }),
    );
    expect(tx.timesheetChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "MEAL_ADJUSTED", before: { mealBreakMinutes: null }, after: { mealBreakMinutes: 60 } }),
    });
  });

  it("puts a day back on the company's policy", async () => {
    const { ctx, db } = context();
    db.timesheetDay.findFirst.mockResolvedValue({ id: "d1", mealBreakMinutes: 60 });
    await adjustMeal(ctx, "worker", "2026-11-16", null, "Entered on the wrong day");
    expect(tx.timesheetDay.delete).toHaveBeenCalled();
  });

  it("writes nothing when the day already says so", async () => {
    const { ctx } = context();
    await adjustMeal(ctx, "worker", "2026-11-16", null, "x");
    expect(tx.timesheetChange.create).not.toHaveBeenCalled();
  });
});
