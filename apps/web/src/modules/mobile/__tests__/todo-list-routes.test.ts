/** @jest-environment node */
const mobileSessionFrom = jest.fn();
const buildCompanyContext = jest.fn();
const jobContextFor = jest.fn();
const findTodoList = jest.fn();
const createTodoList = jest.fn();
const updateTodoList = jest.fn();

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
  findTodoList: (...args: unknown[]) => findTodoList(...args),
  createTodoList: (...args: unknown[]) => createTodoList(...args),
  updateTodoList: (...args: unknown[]) => updateTodoList(...args),
}));

import { POST } from "@/app/api/m/v1/jobs/[id]/todo-lists/route";
import { PATCH } from "@/app/api/m/v1/todo-lists/[id]/route";

/**
 * Lists from the app: made at the bottom of the job's, and edited field by
 * field, so renaming one from a phone keeps the description written on the web.
 */

const ctx = (permissions: string[]) => ({ user: { id: "u1" }, company: { id: "c1" }, permissions: new Set(permissions) });
const list = { id: "l1", jobId: "job-from-row", name: "Prep", description: "<ul><li>Formatted</li></ul>", createdById: null };
const headers = { "content-type": "application/json", "x-nodo-company": "acme" };

const create = (body: unknown) =>
  POST(new Request("http://localhost/api/m/v1/jobs/j1/todo-lists", { method: "POST", headers, body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: "j1" }),
  });
const patch = (body: unknown) =>
  PATCH(new Request("http://localhost/api/m/v1/todo-lists/l1", { method: "PATCH", headers, body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: "l1" }),
  });

beforeEach(() => {
  jest.resetAllMocks();
  mobileSessionFrom.mockResolvedValue({ id: "s1", userId: "u1" });
  buildCompanyContext.mockResolvedValue(ctx(["jobs.read", "todos.read", "todos.create", "todos.update"]));
  jobContextFor.mockImplementation(async (base, jobId) => ({ ctx: base, job: { id: jobId, name: "Job", closed: false } }));
  findTodoList.mockResolvedValue(list);
  createTodoList.mockResolvedValue("l2");
});

it("creates a list with its description turned into HTML", async () => {
  const response = await create({ name: " Plastering ", description: "Two coats" });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: "l2" });
  expect(createTodoList).toHaveBeenCalledWith(expect.anything(), "j1", { name: "Plastering", description: "<p>Two coats</p>" });
});

it("refuses a list with no name, with the web's key", async () => {
  const response = await create({ name: "  " });
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({ error: "invalid", fields: { name: ["validation.required"] } });
  expect(createTodoList).not.toHaveBeenCalled();
});

it("renames a list and keeps the description it had", async () => {
  expect((await patch({ name: "Prep work" })).status).toBe(200);
  expect(updateTodoList).toHaveBeenCalledWith(expect.anything(), list, { name: "Prep work", description: list.description });
  expect(jobContextFor).toHaveBeenCalledWith(expect.anything(), "job-from-row", "todos.update");
});

it("clears the description when an empty one is sent", async () => {
  await patch({ description: "" });
  expect(updateTodoList).toHaveBeenCalledWith(expect.anything(), list, { name: "Prep", description: null });
});

it("answers 404 for an unknown list and 403 without the tool's read permission", async () => {
  findTodoList.mockResolvedValueOnce(null);
  expect((await patch({ name: "X" })).status).toBe(404);

  buildCompanyContext.mockResolvedValue(ctx(["jobs.read", "todos.create"]));
  const forbidden = await create({ name: "X" });
  expect(forbidden.status).toBe(403);
  expect(await forbidden.json()).toEqual({ error: "forbidden", permission: "todos.read" });
  expect(updateTodoList).not.toHaveBeenCalled();
});
