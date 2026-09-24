import { InvitationStatus } from "@/generated/prisma/enums";
import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  invitationState,
  invitationUrl,
  INVITATION_DAYS,
} from "../invitations";

describe("the invitation token", () => {
  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateInvitationToken().token));
    expect(seen.size).toBe(50);
  });

  it("stores a hash, not the token", () => {
    const { token, hashedToken } = generateInvitationToken();
    expect(hashedToken).not.toBe(token);
    expect(hashedToken).toHaveLength(64);
    expect(hashInvitationToken(token)).toBe(hashedToken);
  });

  it("is long enough not to be guessed", () => {
    expect(generateInvitationToken().token.length).toBeGreaterThan(40);
  });
});

describe("invitationExpiry", () => {
  it("gives the invitee a week", () => {
    const now = new Date("2026-03-01T10:00:00Z");
    const days = (invitationExpiry(now).getTime() - now.getTime()) / 86_400_000;
    expect(days).toBe(INVITATION_DAYS);
  });
});

describe("invitationState", () => {
  const future = new Date("2026-03-10T00:00:00Z");
  const now = new Date("2026-03-01T00:00:00Z");

  it("accepts a pending invitation that hasn't expired", () => {
    expect(invitationState({ status: InvitationStatus.PENDING, expiresAt: future }, now)).toBe("ok");
  });

  it("works expiry out from the date, not from the stored status", () => {
    // Nothing sweeps the table, so a PENDING row past its date is normal.
    const past = new Date("2026-02-20T00:00:00Z");
    expect(invitationState({ status: InvitationStatus.PENDING, expiresAt: past }, now)).toBe("expired");
  });

  it("treats the exact moment of expiry as expired", () => {
    expect(invitationState({ status: InvitationStatus.PENDING, expiresAt: now }, now)).toBe("expired");
  });

  it("refuses one that was already used", () => {
    expect(invitationState({ status: InvitationStatus.ACCEPTED, expiresAt: future }, now)).toBe("accepted");
  });

  it("refuses one that was revoked, even before its date", () => {
    expect(invitationState({ status: InvitationStatus.REVOKED, expiresAt: future }, now)).toBe("revoked");
  });

  it("has nothing to say about a token that matched nothing", () => {
    expect(invitationState(null, now)).toBe("not-found");
  });
});

describe("invitationUrl", () => {
  it("points at the company's own subdomain", () => {
    expect(invitationUrl("acme", "abc", "crm.nodo.co.nz")).toBe("https://acme.crm.nodo.co.nz/join/abc");
  });

  it("drops to http for local development", () => {
    expect(invitationUrl("acme", "abc", "localhost:3100")).toBe("http://acme.localhost:3100/join/abc");
  });
});
