import { nextFollowUp } from "../follow-up";

/**
 * The follow-up a person may send by hand. Getting it wrong either chases a
 * customer twice or, through the new link a follow-up issues, reopens a link
 * somebody closed on purpose.
 */

const now = new Date("2026-11-17T04:00:00Z");
const open = {
  status: "SENT" as const,
  validUntil: new Date("2026-12-01T00:00:00Z"),
  share: { revokedAt: null },
  emailsSent: [{ kind: "NEW_QUOTE" as const }],
};

it("offers the first, then the second, then nothing", () => {
  expect(nextFollowUp(open, now)).toBe("FIRST_FOLLOW_UP");
  const first = { ...open, emailsSent: [...open.emailsSent, { kind: "FIRST_FOLLOW_UP" as const }] };
  expect(nextFollowUp(first, now)).toBe("SECOND_FOLLOW_UP");
  const both = { ...first, emailsSent: [...first.emailsSent, { kind: "SECOND_FOLLOW_UP" as const }] };
  expect(nextFollowUp(both, now)).toBeNull();
});

it("offers nothing on a quote that isn't waiting for an answer", () => {
  expect(nextFollowUp({ ...open, status: "ACCEPTED" }, now)).toBeNull();
  expect(nextFollowUp({ ...open, status: "DRAFT" }, now)).toBeNull();
  expect(nextFollowUp({ ...open, status: "EXPIRED" }, now)).toBeNull();
});

it("offers nothing once the quote ran out, even before the sweep closed it", () => {
  expect(nextFollowUp({ ...open, validUntil: new Date("2026-11-13T00:00:00Z") }, now)).toBeNull();
});

it("won't reopen a link somebody closed", () => {
  expect(nextFollowUp({ ...open, share: { revokedAt: now } }, now)).toBeNull();
  expect(nextFollowUp({ ...open, share: null }, now)).toBeNull();
});
