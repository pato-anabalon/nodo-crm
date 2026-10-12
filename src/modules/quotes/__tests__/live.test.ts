import { QuoteStatus } from "@/generated/prisma/enums";
import { CLOSED_POLL_SECONDS, LIVE_POLL_SECONDS, livePollSeconds } from "../live";

const now = new Date("2026-10-12T10:00:00Z");
const open = { revokedAt: null, expiresAt: null };

describe("livePollSeconds", () => {
  it("asks at full speed while the quote is still awaiting an answer", () => {
    expect(livePollSeconds(QuoteStatus.SENT, open, now)).toBe(LIVE_POLL_SECONDS);
  });

  it.each([QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED])(
    "keeps listening, slower, on a %s quote whose link still opens — the customer can still write",
    (status) => {
      expect(livePollSeconds(status, open, now)).toBe(CLOSED_POLL_SECONDS);
    },
  );

  it("stops once the link is revoked: nobody can open it or write on it", () => {
    expect(livePollSeconds(QuoteStatus.SENT, { revokedAt: now, expiresAt: null }, now)).toBeNull();
  });

  it("stops once the link has expired", () => {
    const expiresAt = new Date(now.getTime() - 1000);
    expect(livePollSeconds(QuoteStatus.SENT, { revokedAt: null, expiresAt }, now)).toBeNull();
  });

  it("stops when the quote was never shared", () => {
    expect(livePollSeconds(QuoteStatus.DRAFT, null, now)).toBeNull();
  });
});
