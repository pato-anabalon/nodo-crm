/** @jest-environment node */
const mobileSessionFrom = jest.fn();
const buildCompanyContext = jest.fn();
const jobContextFor = jest.fn();
const findTodo = jest.fn();
const setTodoCompleted = jest.fn();

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
jest.mock("@/modules/jobs/todos/service", () => ({
  findTodo: (...args: unknown[]) => findTodo(...args),
  setTodoCompleted: (...args: unknown[]) => setTodoCompleted(...args),
}));

import { PUT } from "@/app/api/m/v1/todos/[id]/completion/route";
import { JobClosedError } from "@/modules/jobs/closing";

/**
 * The app's routes answer the same questions the web's actions do, with a
 * status instead of a page. Ticking a to-do off is the door worth pinning:
 * it is the one a Worker has, and the job it acts on must come from the row.
 */

const ctx = (permissions: string[]) => ({ user: { id: "u1" }, company: { id: "c1" }, permissions: new Set(permissions) });
const todo = { id: "t1", jobId: "job-from-row", listId: "l1", title: "Sand", createdById: null, completedAt: null };

function call(body: unknown = { done: true }, headers: Record<string, string> = { "x-nodo-company": "acme" }) {
  const request = new Request("http://localhost/api/m/v1/todos/t1/completion", {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return PUT(request, { params: Promise.resolve({ id: "t1" }) });
}

beforeEach(() => {
  jest.resetAllMocks();
  mobileSessionFrom.mockResolvedValue({ id: "s1", userId: "u1" });
  buildCompanyContext.mockResolvedValue(ctx(["jobs.read", "todos.read", "todos.complete"]));
  findTodo.mockResolvedValue(todo);
  jobContextFor.mockImplementation(async (base) => ({ ctx: base, job: { id: "job-from-row", name: "Job", closed: false } }));
  setTodoCompleted.mockResolvedValue(true);
});

it("ticks the to-do off on the job read from its row", async () => {
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ done: true, changed: true });
  expect(jobContextFor).toHaveBeenCalledWith(expect.anything(), "job-from-row", "todos.complete");
  expect(setTodoCompleted).toHaveBeenCalledWith(expect.anything(), todo, true);
});

it("says when a second press changed nothing", async () => {
  setTodoCompleted.mockResolvedValue(false);
  expect(await (await call()).json()).toEqual({ done: true, changed: false });
});

it("refuses without a session", async () => {
  mobileSessionFrom.mockResolvedValue(null);
  const response = await call();
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "unauthenticated" });
});

it("asks which company", async () => {
  const response = await call({ done: true }, {});
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "company_required" });
});

it("refuses a profile that can only edit, not tick", async () => {
  buildCompanyContext.mockResolvedValue(ctx(["jobs.read", "todos.read", "todos.update"]));
  const response = await call();
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "forbidden", permission: "todos.complete" });
  expect(setTodoCompleted).not.toHaveBeenCalled();
});

it("needs the tool's read permission as well", async () => {
  buildCompanyContext.mockResolvedValue(ctx(["jobs.read", "todos.complete"]));
  const response = await call();
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "forbidden", permission: "todos.read" });
});

it("answers 404 for a to-do that doesn't exist and for a job this person can't see", async () => {
  findTodo.mockResolvedValueOnce(null);
  expect((await call()).status).toBe(404);

  jobContextFor.mockResolvedValueOnce(null);
  const hidden = await call();
  expect(hidden.status).toBe(404);
  expect(await hidden.json()).toEqual({ error: "not_found" });
  expect(setTodoCompleted).not.toHaveBeenCalled();
});

it("refuses a finished job with its own code", async () => {
  jobContextFor.mockRejectedValue(new JobClosedError("job-from-row"));
  const response = await call();
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "job_closed" });
});

it("answers a malformed body with codes, not sentences", async () => {
  const missing = await call({});
  expect(missing.status).toBe(422);
  expect(await missing.json()).toEqual({ error: "invalid", fields: { done: ["validation.invalid"] } });

  const broken = await call("{done");
  expect(broken.status).toBe(400);
  expect(await broken.json()).toEqual({ error: "invalid_json" });
});
