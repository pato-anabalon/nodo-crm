import { QuoteStatus } from "@/generated/prisma/enums";
import { canReopen, reopenRefusal } from "../reopen";

const now = new Date("2026-11-26T03:00:00Z");
const expired = { status: QuoteStatus.EXPIRED, number: 3100 };

describe("reopenRefusal", () => {
  it("reopens an expired quote made here with a date still ahead", () => {
    expect(reopenRefusal(expired, 3000, "2026-12-15", now)).toBeNull();
  });

  it("refuses what isn't a date that passed", () => {
    for (const status of [QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.ACCEPTED, QuoteStatus.REJECTED]) {
      expect(reopenRefusal({ ...expired, status }, 3000, "2026-12-15", now)).toBe("not-expired");
    }
  });

  it("leaves a quote brought in from another tool to that tool", () => {
    expect(reopenRefusal({ ...expired, number: 2999 }, 3000, "2026-12-15", now)).toBe("imported");
    expect(canReopen({ ...expired, number: 2999 }, 3000)).toBe(false);
  });

  it("asks for a date, and one the sweep wouldn't close again tonight", () => {
    expect(reopenRefusal(expired, 3000, null, now)).toBe("date-required");
    expect(reopenRefusal(expired, 3000, "15/12/2026", now)).toBe("date-required");
    expect(reopenRefusal(expired, 3000, "2026-11-26", now)).toBe("date-past");
    expect(reopenRefusal(expired, 3000, "2026-11-01", now)).toBe("date-past");
  });

  it("offers the button only where it can work", () => {
    expect(canReopen(expired, 3000)).toBe(true);
    expect(canReopen({ ...expired, status: QuoteStatus.REJECTED }, 3000)).toBe(false);
  });
});
