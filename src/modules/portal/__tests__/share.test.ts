import {
  HEARTBEAT_SECONDS,
  PRESENCE_WINDOW_SECONDS,
  generateShareToken,
  hashShareToken,
  isViewingNow,
  shareStatus,
  shareUrl,
} from "../share";

describe("generateShareToken", () => {
  it("the stored hash matches the link's token", () => {
    const { token, hashedToken } = generateShareToken();
    expect(hashedToken).toBe(hashShareToken(token));
  });

  it("never repeats a token", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateShareToken().token));
    expect(tokens.size).toBe(200);
  });

  it("is long enough that it cannot be guessed", () => {
    expect(generateShareToken().token.length).toBeGreaterThanOrEqual(40);
  });

  it("the token cannot be recovered from the hash", () => {
    const { token, hashedToken } = generateShareToken();
    expect(hashedToken).not.toContain(token.slice(0, 12));
  });
});

describe("isViewingNow", () => {
  const now = new Date("2026-09-18T12:00:00Z");
  const secondsAgo = (n: number) => new Date(now.getTime() - n * 1000);

  it("is watching when it beat recently", () => {
    expect(isViewingNow(secondsAgo(5), now)).toBe(true);
    expect(isViewingNow(secondsAgo(HEARTBEAT_SECONDS), now)).toBe(true);
  });

  it("stops being watched once the window passes", () => {
    expect(isViewingNow(secondsAgo(PRESENCE_WINDOW_SECONDS + 1), now)).toBe(false);
    expect(isViewingNow(secondsAgo(600), now)).toBe(false);
  });

  it("right on the edge it still counts", () => {
    expect(isViewingNow(secondsAgo(PRESENCE_WINDOW_SECONDS), now)).toBe(true);
  });

  it("has never been opened", () => {
    expect(isViewingNow(null, now)).toBe(false);
  });

  it("ignores a timestamp in the future, which can only come from a skewed clock", () => {
    expect(isViewingNow(new Date(now.getTime() + 60_000), now)).toBe(false);
  });

  it("the window leaves room to miss one beat", () => {
    expect(PRESENCE_WINDOW_SECONDS).toBeGreaterThan(HEARTBEAT_SECONDS * 2);
  });
});

describe("shareStatus", () => {
  const now = new Date("2026-09-18T12:00:00Z");

  it("a valid link works", () => {
    expect(shareStatus({ revokedAt: null, expiresAt: null }, now)).toBe("ok");
  });

  it("a revoked link does not work, even before it expires", () => {
    expect(shareStatus({ revokedAt: now, expiresAt: null }, now)).toBe("revoked");
  });

  it("an expired link does not work", () => {
    const expired = new Date(now.getTime() - 1000);
    expect(shareStatus({ revokedAt: null, expiresAt: expired }, now)).toBe("expired");
  });

  it("revocation outweighs expiry", () => {
    const expired = new Date(now.getTime() - 1000);
    expect(shareStatus({ revokedAt: now, expiresAt: expired }, now)).toBe("revoked");
  });

  it("a link that does not exist", () => {
    expect(shareStatus(null, now)).toBe("not-found");
  });
});

describe("shareUrl", () => {
  it("points at the company's subdomain, so the customer sees their brand", () => {
    expect(shareUrl("acme", "TOKEN123", "crm.nodo.co.nz")).toBe(
      "https://acme.crm.nodo.co.nz/q/TOKEN123",
    );
  });

  it("uses http locally", () => {
    expect(shareUrl("acme", "T", "localhost:3100")).toBe("http://acme.localhost:3100/q/T");
  });
});
