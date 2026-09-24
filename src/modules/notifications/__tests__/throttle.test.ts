import { shouldNotifyOpen } from "../throttle";

const at = (iso: string) => ({ createdAt: new Date(iso) });

describe("shouldNotifyOpen", () => {
  const now = new Date("2026-09-18T15:00:00");

  it("notifies the first time it is opened", () => {
    expect(shouldNotifyOpen([], now)).toBe(true);
  });

  it("does not notify again once it has been opened today", () => {
    expect(shouldNotifyOpen([at("2026-09-18T09:30:00")], now)).toBe(false);
  });

  it("notifies again when the last open was yesterday", () => {
    expect(shouldNotifyOpen([at("2026-09-17T23:59:00")], now)).toBe(true);
  });

  it("counts from midnight, not from the previous 24 hours", () => {
    // 11pm last night is less than 24 hours ago, but it's another day.
    expect(shouldNotifyOpen([at("2026-09-17T23:00:00")], now)).toBe(true);
  });

  it("one open from today among several old ones is enough", () => {
    const opens = [at("2026-09-10T10:00:00"), at("2026-09-18T08:00:00"), at("2026-09-01T10:00:00")];
    expect(shouldNotifyOpen(opens, now)).toBe(false);
  });
});
