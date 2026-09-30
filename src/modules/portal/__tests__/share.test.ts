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
  const beating = (lastSeenAt: Date | null) => ({ viewing: true, lastSeenAt });

  it("is watching when it beat recently", () => {
    expect(isViewingNow(beating(secondsAgo(5)), now)).toBe(true);
    expect(isViewingNow(beating(secondsAgo(HEARTBEAT_SECONDS)), now)).toBe(true);
  });

  it("stops being watched once the window passes without a beat", () => {
    expect(isViewingNow(beating(secondsAgo(PRESENCE_WINDOW_SECONDS + 1)), now)).toBe(false);
    expect(isViewingNow(beating(secondsAgo(600)), now)).toBe(false);
  });

  it("right on the edge it still counts", () => {
    expect(isViewingNow(beating(secondsAgo(PRESENCE_WINDOW_SECONDS)), now)).toBe(true);
  });

  it("has never been opened", () => {
    expect(isViewingNow(beating(null), now)).toBe(false);
  });

  it("ignores a timestamp in the future, which can only come from a skewed clock", () => {
    expect(isViewingNow(beating(new Date(now.getTime() + 60_000)), now)).toBe(false);
  });

  it("the window leaves room to miss one beat", () => {
    expect(PRESENCE_WINDOW_SECONDS).toBeGreaterThan(HEARTBEAT_SECONDS * 2);
  });

  /**
   * `viewing` is what makes a closed tab stop reading as watched the moment
   * it closes, rather than only once the window runs out: `markLeft` sets it
   * false straight away, on a `lastSeenAt` that's still fresh — a recent beat
   * on its own isn't enough once the tab has said it's leaving.
   */
  it("a tab that said it's leaving stops counting even with a fresh beat", () => {
    expect(isViewingNow({ viewing: false, lastSeenAt: secondsAgo(1) }, now)).toBe(false);
  });

  /**
   * The reverse of that: a `viewing: true` left behind by a tab that vanished
   * without saying so — a crash, a killed process — still can't claim to be
   * watched forever. The window is the fallback for exactly this case.
   */
  it("a stale viewing flag still expires once the window passes", () => {
    expect(isViewingNow({ viewing: true, lastSeenAt: secondsAgo(600) }, now)).toBe(false);
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
