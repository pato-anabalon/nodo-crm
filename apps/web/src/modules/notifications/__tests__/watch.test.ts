import { IngestOutcome } from "@/generated/prisma/enums";
import {
  BROKEN_THRESHOLD,
  dailyKey,
  formLooksBroken,
  hasExpired,
  isBrokenOutcome,
  isExpiring,
} from "../watch";

const now = new Date("2026-03-10T09:00:00Z");
const on = (iso: string) => ({ validUntil: new Date(iso) });

describe("isExpiring", () => {
  it("catches one running out inside the window", () => {
    expect(isExpiring(on("2026-03-12T00:00:00Z"), now)).toBe(true);
  });

  it("leaves one with plenty of time alone", () => {
    expect(isExpiring(on("2026-03-30T00:00:00Z"), now)).toBe(false);
  });

  it("includes one that already lapsed", () => {
    // More urgent than one lapsing tomorrow, not less: somebody has to act.
    expect(isExpiring(on("2026-03-01T00:00:00Z"), now)).toBe(true);
  });

  it("says nothing about a quote with no date", () => {
    expect(isExpiring({ validUntil: null }, now)).toBe(false);
  });

  it("respects a different window", () => {
    expect(isExpiring(on("2026-03-20T00:00:00Z"), now, 30)).toBe(true);
  });
});

describe("hasExpired", () => {
  it("is false for one still inside its validity", () => {
    expect(hasExpired(on("2026-03-12T00:00:00Z"), now)).toBe(false);
  });

  it("is true the moment validity has run out, not a few days ahead of it", () => {
    // This is the line `isExpiring` crosses three days early; `hasExpired`
    // only crosses it when there's genuinely nothing left to wait for.
    expect(hasExpired(on("2026-03-09T00:00:00Z"), now)).toBe(true);
  });

  it("is false at the exact instant, and true the instant after", () => {
    expect(hasExpired(on(now.toISOString()), now)).toBe(false);
    expect(hasExpired(on(now.toISOString()), new Date(now.getTime() + 1))).toBe(true);
  });

  it("says nothing about a quote with no date — it never expires on its own", () => {
    expect(hasExpired({ validUntil: null }, now)).toBe(false);
  });
});

describe("isBrokenOutcome", () => {
  it.each([
    IngestOutcome.INVALID_KEY,
    IngestOutcome.REVOKED_KEY,
    IngestOutcome.ORIGIN_NOT_ALLOWED,
    IngestOutcome.INVALID_PAYLOAD,
    IngestOutcome.PAYLOAD_TOO_LARGE,
  ])("counts %s, which needs somebody to change something", (outcome) => {
    expect(isBrokenOutcome(outcome)).toBe(true);
  });

  it.each([IngestOutcome.RATE_LIMITED, IngestOutcome.DUPLICATE])(
    "does not count %s, which is a defence working",
    (outcome) => {
      expect(isBrokenOutcome(outcome)).toBe(false);
    },
  );

  it("does not count a lead that got through", () => {
    expect(isBrokenOutcome(IngestOutcome.ACCEPTED)).toBe(false);
  });
});

describe("formLooksBroken", () => {
  it("cries only when nothing is getting through", () => {
    expect(formLooksBroken({ rejected: 5, accepted: 0 })).toBe(true);
  });

  it("stays quiet on a busy site with a few rejections", () => {
    // A hundred leads and three rejections is a working form.
    expect(formLooksBroken({ rejected: 3, accepted: 100 })).toBe(false);
  });

  it("stays quiet below the threshold", () => {
    expect(formLooksBroken({ rejected: BROKEN_THRESHOLD - 1, accepted: 0 })).toBe(false);
  });

  it("stays quiet on a silent day", () => {
    expect(formLooksBroken({ rejected: 0, accepted: 0 })).toBe(false);
  });
});

describe("dailyKey", () => {
  it("is the same all day", () => {
    expect(dailyKey("q", "1", new Date("2026-03-10T01:00:00Z"))).toBe(
      dailyKey("q", "1", new Date("2026-03-10T23:00:00Z")),
    );
  });

  it("separates days, subjects and kinds", () => {
    expect(dailyKey("q", "1", now)).not.toBe(dailyKey("q", "1", new Date("2026-03-11T09:00:00Z")));
    expect(dailyKey("q", "1", now)).not.toBe(dailyKey("q", "2", now));
    expect(dailyKey("q", "1", now)).not.toBe(dailyKey("form", "1", now));
  });
});
