import {
  MAX_BODY_BYTES,
  RATE_LIMIT_PER_IP,
  RATE_LIMIT_PER_KEY,
  checkRate,
  clientIp,
  windowStart,
} from "../limits";

describe("checkRate", () => {
  it("lets it through while there is headroom", () => {
    expect(checkRate({ byKey: 0, byIp: 0 })).toEqual({ limited: false });
    expect(checkRate({ byKey: RATE_LIMIT_PER_KEY - 1, byIp: RATE_LIMIT_PER_IP - 1 })).toEqual({
      limited: false,
    });
  });

  it("cuts off on reaching the key limit", () => {
    expect(checkRate({ byKey: RATE_LIMIT_PER_KEY, byIp: 0 })).toEqual({
      limited: true,
      scope: "key",
    });
  });

  it("cuts off on reaching the IP limit", () => {
    expect(checkRate({ byKey: 0, byIp: RATE_LIMIT_PER_IP })).toEqual({
      limited: true,
      scope: "ip",
    });
  });

  it("reports the key limit first, being the broader one", () => {
    const verdict = checkRate({ byKey: RATE_LIMIT_PER_KEY, byIp: RATE_LIMIT_PER_IP });
    expect(verdict).toEqual({ limited: true, scope: "key" });
  });

  it("the IP limit is far tighter than the key's", () => {
    expect(RATE_LIMIT_PER_IP).toBeLessThan(RATE_LIMIT_PER_KEY);
  });
});

describe("windowStart", () => {
  it("steps back one hour from the given moment", () => {
    const now = new Date("2026-09-18T12:00:00Z");
    expect(windowStart(now).toISOString()).toBe("2026-09-18T11:00:00.000Z");
  });
});

describe("clientIp", () => {
  it("takes the first of x-forwarded-for, which is the real client", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.42, 70.41.3.18, 150.172.238.178" });
    expect(clientIp(headers)).toBe("203.0.113.42");
  });

  it("falls back to x-real-ip when there is no forwarded", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("returns null when there is nothing", () => {
    expect(clientIp(new Headers())).toBeNull();
    expect(clientIp(new Headers({ "x-forwarded-for": "  " }))).toBeNull();
  });
});

describe("MAX_BODY_BYTES", () => {
  it("is roomy for a form but nowhere near allowing a dump", () => {
    expect(MAX_BODY_BYTES).toBeGreaterThan(8 * 1024);
    expect(MAX_BODY_BYTES).toBeLessThanOrEqual(128 * 1024);
  });
});
