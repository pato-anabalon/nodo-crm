import { CUSTOMER_NOTICE_EVERY_MS, customerNotice } from "../update-notice";

const now = new Date("2026-11-24T20:00:00Z");
const opened = { openCount: 2, revokedAt: null };

it("has nothing to say about a quote nobody opened", () => {
  expect(customerNotice({ share: { openCount: 0, revokedAt: null }, ranOut: false, lastSentAt: null, now })).toEqual({ kind: "unopened" });
});

it("won't hand out a link that was shut, or one to a quote that ran out", () => {
  expect(customerNotice({ share: { openCount: 3, revokedAt: now }, ranOut: false, lastSentAt: null, now })).toEqual({ kind: "closed" });
  expect(customerNotice({ share: opened, ranOut: true, lastSentAt: null, now })).toEqual({ kind: "closed" });
  expect(customerNotice({ share: null, ranOut: false, lastSentAt: null, now })).toEqual({ kind: "closed" });
});

it("tells an opened quote's customer once every twelve hours at most", () => {
  expect(customerNotice({ share: opened, ranOut: false, lastSentAt: null, now })).toEqual({ kind: "ready" });
  const lastSentAt = new Date(now.getTime() - 60 * 60_000);
  expect(customerNotice({ share: opened, ranOut: false, lastSentAt, now })).toEqual({
    kind: "waiting",
    until: new Date(lastSentAt.getTime() + CUSTOMER_NOTICE_EVERY_MS),
  });
  const longAgo = new Date(now.getTime() - CUSTOMER_NOTICE_EVERY_MS);
  expect(customerNotice({ share: opened, ranOut: false, lastSentAt: longAgo, now })).toEqual({ kind: "ready" });
});
