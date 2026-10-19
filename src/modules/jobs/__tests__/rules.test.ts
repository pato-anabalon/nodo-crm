import type { Permission } from "@/lib/auth/permissions";
import { canTouch } from "../rules";
import { jobVisibilityWhere } from "../scope";
import { jobNameFromQuote } from "../naming";

const perms = (...keys: Permission[]) => new Set<Permission>(keys);

describe("jobVisibilityWhere", () => {
  it("sees only the jobs somebody is a member of", () => {
    expect(jobVisibilityWhere("u1", perms("jobs.read"))).toEqual({ members: { some: { userId: "u1" } } });
  });

  it("sees every job with jobs.read.all", () => {
    expect(jobVisibilityWhere("u1", perms("jobs.read", "jobs.read.all"))).toEqual({});
  });
});

describe("canTouch", () => {
  it("lets the author edit their own content with the permission", () => {
    expect(canTouch("u1", perms("messages.update"), "messages.update", "u1")).toBe(true);
  });

  it("refuses the author without the permission", () => {
    expect(canTouch("u1", perms("messages.create"), "messages.update", "u1")).toBe(false);
  });

  it("refuses somebody else's content without jobs.moderate", () => {
    expect(canTouch("u1", perms("messages.update"), "messages.update", "u2")).toBe(false);
  });

  it("lets a moderator touch somebody else's content", () => {
    expect(canTouch("u1", perms("messages.update", "jobs.moderate"), "messages.update", "u2")).toBe(true);
  });

  it("moderating is not a permission by itself", () => {
    expect(canTouch("u1", perms("jobs.moderate"), "messages.delete", "u2")).toBe(false);
  });

  it("content whose author is gone belongs to nobody", () => {
    expect(canTouch("u1", perms("files.delete"), "files.delete", null)).toBe(false);
    expect(canTouch("u1", perms("files.delete", "jobs.moderate"), "files.delete", null)).toBe(true);
  });
});

describe("jobNameFromQuote", () => {
  it("puts the address before the quote's reference", () => {
    expect(
      jobNameFromQuote({ projectAddress: "15 Ellerton Road, Mount Eden", title: "Exterior paint", reference: "COT-000123" }),
    ).toBe("15 Ellerton Road, Mount Eden - COT-000123");
  });

  it("falls back to the title without an address", () => {
    expect(jobNameFromQuote({ projectAddress: null, title: "Exterior paint", reference: "COT-000123" })).toBe(
      "Exterior paint - COT-000123",
    );
    expect(jobNameFromQuote({ projectAddress: "   ", title: "Exterior paint", reference: "COT-000123" })).toBe(
      "Exterior paint - COT-000123",
    );
  });

  it("collapses stray whitespace in the address", () => {
    expect(
      jobNameFromQuote({ projectAddress: "  15 Ellerton\n Road  ", title: "x", reference: "COT-000123" }),
    ).toBe("15 Ellerton Road - COT-000123");
  });

  it("always carries the reference", () => {
    expect(jobNameFromQuote({ projectAddress: null, title: " ", reference: "COT-000123" })).toBe("COT-000123");
  });
});
