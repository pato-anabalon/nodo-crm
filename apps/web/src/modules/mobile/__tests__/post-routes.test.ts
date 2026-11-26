/** @jest-environment node */
const mobileSessionFrom = jest.fn();
const buildCompanyContext = jest.fn();
const jobContextFor = jest.fn();
const findPost = jest.fn();
const getPost = jest.fn();
const createComment = jest.fn();

jest.mock("@/modules/mobile/session", () => ({ mobileSessionFrom: (...args: unknown[]) => mobileSessionFrom(...args) }));
jest.mock("@/lib/auth/session", () => {
  class ForbiddenError extends Error {
    constructor(public readonly permission: string) {
      super(`Missing permission ${permission}`);
    }
  }
  return {
    ForbiddenError,
    buildCompanyContext: (...args: unknown[]) => buildCompanyContext(...args),
    can: (ctx: { permissions: Set<string> }, permission: string) => ctx.permissions.has(permission),
  };
});
jest.mock("@/modules/jobs/access", () => ({ jobContextFor: (...args: unknown[]) => jobContextFor(...args) }));
jest.mock("@/modules/jobs/board/service", () => ({
  findPost: (...args: unknown[]) => findPost(...args),
  getPost: (...args: unknown[]) => getPost(...args),
  createComment: (...args: unknown[]) => createComment(...args),
}));

import { GET } from "@/app/api/m/v1/posts/[id]/route";
import { POST } from "@/app/api/m/v1/posts/[id]/comments/route";

/**
 * The Message Board from the app is read-only but for comments. A draft is
 * nobody's to read from the phone — not even its author's, who can't finish it
 * there — and commenting also takes the board's read permission, as on the web.
 */

const ctx = (permissions: string[]) => ({ user: { id: "u1" }, company: { id: "c1" }, permissions: new Set(permissions) });
const published = { id: "p1", jobId: "job-from-row", board: "TEAM", authorId: "u2", title: "Week 3", publishedAt: new Date("2026-11-01T00:00:00Z") };
const route = { params: Promise.resolve({ id: "p1" }) };
const headers = { "content-type": "application/json", "x-nodo-company": "acme" };

const read = () => GET(new Request("http://localhost/api/m/v1/posts/p1", { headers }), route);
const comment = (body: unknown) =>
  POST(new Request("http://localhost/api/m/v1/posts/p1/comments", { method: "POST", headers, body: JSON.stringify(body) }), route);

beforeEach(() => {
  jest.resetAllMocks();
  mobileSessionFrom.mockResolvedValue({ id: "s1", userId: "u1" });
  buildCompanyContext.mockResolvedValue(ctx(["jobs.read", "messages.read", "comments.create"]));
  jobContextFor.mockImplementation(async (base) => ({ ctx: base, job: { id: "job-from-row", name: "Job", closed: false } }));
  findPost.mockResolvedValue(published);
  createComment.mockResolvedValue({ ok: true, commentId: "c9" });
});

it("reads a published post with its body sanitised and its comments' flags", async () => {
  getPost.mockResolvedValue({
    ...published,
    body: '<p>Plaster <script>alert(1)</script>done</p>',
    editedAt: null,
    createdAt: published.publishedAt,
    author: { id: "u2", name: "Ana", email: "a@x", image: null },
    category: null,
    files: [],
    comments: [
      { id: "c1", body: "<p>Mine</p>", authorId: "u1", createdAt: published.publishedAt, editedAt: null, author: null, files: [] },
    ],
  });
  const response = await read();
  expect(response.status).toBe(200);
  const { post } = await response.json();
  expect(post.body).toBe("<p>Plaster done</p>");
  expect(post.publishedAt).toBe("2026-11-01T00:00:00.000Z");
  expect(post.comments[0]).toMatchObject({ id: "c1", canUpdate: false, canDelete: false });
  expect(jobContextFor).toHaveBeenCalledWith(expect.anything(), "job-from-row", "messages.read");
});

it("holds a confidential post to the confidential board's permission, not the Message Board's", async () => {
  findPost.mockResolvedValue({ ...published, board: "CONFIDENTIAL" });
  // As `jobContextFor` does: a job this person may not act on this way isn't one they see.
  jobContextFor.mockImplementation(async (base, jobId, permission) =>
    base.permissions.has(permission) ? { ctx: base, job: { id: jobId, name: "Job", closed: false } } : null,
  );
  expect((await read()).status).toBe(404);
  expect(jobContextFor).toHaveBeenCalledWith(expect.anything(), "job-from-row", "confidential.read");
  const forbidden = await comment({ body: "Hi" });
  expect(forbidden.status).toBe(403);
  expect(await forbidden.json()).toEqual({ error: "forbidden", permission: "confidential.read" });
  expect(getPost).not.toHaveBeenCalled();
  expect(createComment).not.toHaveBeenCalled();

  buildCompanyContext.mockResolvedValue(ctx(["jobs.read", "confidential.read"]));
  getPost.mockResolvedValue(null);
  expect((await read()).status).toBe(404);
  expect(getPost).toHaveBeenCalledWith(expect.anything(), "job-from-row", "CONFIDENTIAL", "p1");
});

it("answers 404 for a draft, even the reader's own", async () => {
  findPost.mockResolvedValue({ ...published, authorId: "u1", publishedAt: null });
  expect((await read()).status).toBe(404);
  expect((await comment({ body: "Hi" })).status).toBe(404);
  expect(getPost).not.toHaveBeenCalled();
  expect(createComment).not.toHaveBeenCalled();
});

it("comments on the post read from its row, as HTML", async () => {
  const response = await comment({ body: "Looks good\nThanks" });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: "c9" });
  expect(createComment).toHaveBeenCalledWith(expect.anything(), published, expect.stringContaining("<p>"), []);
});

it("needs the board's read permission to comment, and something to say", async () => {
  buildCompanyContext.mockResolvedValue(ctx(["jobs.read", "comments.create"]));
  const forbidden = await comment({ body: "Hi" });
  expect(forbidden.status).toBe(403);
  expect(await forbidden.json()).toEqual({ error: "forbidden", permission: "messages.read" });

  buildCompanyContext.mockResolvedValue(ctx(["jobs.read", "messages.read", "comments.create"]));
  createComment.mockResolvedValue({ ok: false, reason: "empty" });
  const empty = await comment({ body: "  " });
  expect(empty.status).toBe(422);
  expect(await empty.json()).toEqual({ error: "empty" });
});
