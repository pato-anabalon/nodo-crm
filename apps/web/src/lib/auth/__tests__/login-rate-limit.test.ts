import { RATE_LIMIT_PER_IP, clientIp, loginRateLimited, windowStart } from "../login-rate-limit";

describe("loginRateLimited", () => {
  it("lets it through while there is headroom", () => {
    expect(loginRateLimited(0)).toBe(false);
    expect(loginRateLimited(RATE_LIMIT_PER_IP - 1)).toBe(false);
  });

  it("cuts off on reaching the limit", () => {
    expect(loginRateLimited(RATE_LIMIT_PER_IP)).toBe(true);
    expect(loginRateLimited(RATE_LIMIT_PER_IP + 1)).toBe(true);
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
