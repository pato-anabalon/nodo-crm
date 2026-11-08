import {
  CODE_MAX_ATTEMPTS,
  bearerToken,
  challengeState,
  codeMatches,
  generateCode,
  generateSessionToken,
  hashCode,
  hashToken,
  maskEmail,
  sessionExpiry,
  sessionState,
  shouldSlide,
} from "../tokens";

const now = new Date("2026-11-08T10:00:00Z");
const hours = (n: number) => new Date(now.getTime() - n * 60 * 60 * 1000);

describe("session tokens", () => {
  it("stores only a hash that the token reproduces", () => {
    const { token, tokenHash } = generateSessionToken();
    expect(token.startsWith("nodo_mt_")).toBe(true);
    expect(tokenHash).not.toContain(token);
    expect(hashToken(token)).toBe(tokenHash);
  });

  it("reads a bearer header, and nothing that isn't one of ours", () => {
    const { token } = generateSessionToken();
    expect(bearerToken(`Bearer ${token}`)).toBe(token);
    expect(bearerToken(`bearer ${token}`)).toBe(token);
    expect(bearerToken("Bearer nodo_pk_something")).toBeNull();
    expect(bearerToken(token)).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });

  it("is revoked before it is expired, and expired at the instant", () => {
    const expiresAt = sessionExpiry(now);
    expect(sessionState({ revokedAt: null, expiresAt }, now)).toBe("ok");
    expect(sessionState({ revokedAt: now, expiresAt }, now)).toBe("revoked");
    expect(sessionState({ revokedAt: null, expiresAt: now }, now)).toBe("expired");
  });

  it("slides once a day, not on every request", () => {
    expect(shouldSlide(hours(1), now)).toBe(false);
    expect(shouldSlide(hours(24), now)).toBe(true);
  });
});

describe("one-time codes", () => {
  const secret = "test-secret";

  it("is six digits, leading zeros kept", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it("matches only the same code on the same challenge", () => {
    const stored = hashCode("ch1", "012345", secret);
    expect(codeMatches(stored, "ch1", "012345", secret)).toBe(true);
    expect(codeMatches(stored, "ch1", " 012345 ", secret)).toBe(true);
    expect(codeMatches(stored, "ch1", "12345", secret)).toBe(false);
    expect(codeMatches(stored, "ch2", "012345", secret)).toBe(false);
    expect(codeMatches(stored, "ch1", "012345", "other-secret")).toBe(false);
  });

  it("refuses a used, expired, exhausted or foreign challenge", () => {
    const base = { consumedAt: null, expiresAt: new Date(now.getTime() + 60_000), attempts: 0, deviceIdHash: "d1" };
    expect(challengeState(base, "d1", now)).toBe("ok");
    expect(challengeState(null, "d1", now)).toBe("not-found");
    expect(challengeState({ ...base, consumedAt: now }, "d1", now)).toBe("used");
    expect(challengeState({ ...base, expiresAt: now }, "d1", now)).toBe("expired");
    expect(challengeState({ ...base, attempts: CODE_MAX_ATTEMPTS }, "d1", now)).toBe("locked");
    expect(challengeState(base, "d2", now)).toBe("other-device");
  });
});

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("pato@plasterpro.co.nz")).toBe("p•••@plasterpro.co.nz");
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });
});
