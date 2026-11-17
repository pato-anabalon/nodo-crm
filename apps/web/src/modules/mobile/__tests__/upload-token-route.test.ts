/** @jest-environment node */
const mobileSessionFrom = jest.fn();
const buildCompanyContext = jest.fn();
const jobContextFor = jest.fn();
const generateClientToken = jest.fn();

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
jest.mock("@vercel/blob/client", () => ({
  generateClientTokenFromReadWriteToken: (...args: unknown[]) => generateClientToken(...args),
}));

import { POST } from "@/app/api/m/v1/jobs/[id]/uploads/route";
import { JobClosedError } from "@/modules/jobs/closing";
import { uploadRefusal } from "@/modules/mobile/jobs/uploads";

/**
 * The app's token to put one file in the store. What matters is that the path
 * is the server's — under this company and this job, whatever name was sent —
 * and that a file the store would refuse anyway is refused before any bytes go.
 */

const MB = 1024 * 1024;
const ctx = (permissions: string[]) => ({ user: { id: "u1" }, company: { id: "c1" }, permissions: new Set(permissions) });

function call(body: unknown) {
  const request = new Request("http://localhost/api/m/v1/jobs/j1/uploads", {
    method: "POST",
    headers: { "content-type": "application/json", "x-nodo-company": "acme" },
    body: JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ id: "j1" }) });
}

beforeEach(() => {
  jest.resetAllMocks();
  mobileSessionFrom.mockResolvedValue({ id: "s1", userId: "u1" });
  buildCompanyContext.mockResolvedValue(ctx(["jobs.read", "chat.create"]));
  jobContextFor.mockImplementation(async (base) => ({ ctx: base, job: { id: "j1", name: "Job", closed: false } }));
  generateClientToken.mockResolvedValue("vercel_blob_client_token");
});

describe("the token route", () => {
  it("hands out a token for a path it built under the job's prefix", async () => {
    const response = await call({ name: "../../other/Site photo.jpg", size: 2 * MB });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      pathname: "companies/c1/jobs/j1/other-Site-photo.jpg",
      clientToken: "vercel_blob_client_token",
      contentType: "image/jpeg",
      maximumSizeInBytes: 25 * MB,
    });
    expect(generateClientToken).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "companies/c1/jobs/j1/other-Site-photo.jpg",
        allowedContentTypes: ["image/jpeg"],
        addRandomSuffix: true,
      }),
    );
    expect(jobContextFor).toHaveBeenCalledWith(expect.anything(), "j1", "chat.create");
  });

  it("puts a thumbnail under thumbnails/ with the thumbnail cap", async () => {
    const body = await (await call({ name: "plan.webp", size: 100_000, thumbnail: true })).json();
    expect(body.pathname).toBe("companies/c1/jobs/j1/thumbnails/plan.webp");
    expect(body.maximumSizeInBytes).toBe(2 * MB);
  });

  it("refuses somebody with no reason to upload anything", async () => {
    buildCompanyContext.mockResolvedValue(ctx(["jobs.read", "files.read"]));
    const response = await call({ name: "a.jpg", size: 1000 });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden", permission: "files.create" });
    expect(generateClientToken).not.toHaveBeenCalled();
  });

  it("answers 404 for a job this person can't see and 409 for a finished one", async () => {
    jobContextFor.mockResolvedValueOnce(null);
    expect((await call({ name: "a.jpg", size: 1000 })).status).toBe(404);

    jobContextFor.mockRejectedValueOnce(new JobClosedError("j1"));
    const closed = await call({ name: "a.jpg", size: 1000 });
    expect(closed.status).toBe(409);
    expect(generateClientToken).not.toHaveBeenCalled();
  });

  it("refuses a file the store would refuse, with a code", async () => {
    const heic = await call({ name: "IMG_0001.HEIC", size: 1000 });
    expect(heic.status).toBe(422);
    expect(await heic.json()).toEqual({ error: "file_heic" });
    expect(await (await call({ name: "setup.exe", size: 1000 })).json()).toEqual({ error: "file_type" });
    expect(await (await call({ name: "a.jpg", size: 30 * MB })).json()).toEqual({ error: "file_too_large" });
    expect(generateClientToken).not.toHaveBeenCalled();
  });
});

describe("uploadRefusal", () => {
  it("holds a photo to the stored ceiling, since the app has compressed it already", () => {
    expect(uploadRefusal({ name: "a.jpg", size: 25 * MB, thumbnail: false })).toBeNull();
    expect(uploadRefusal({ name: "a.jpg", size: 25 * MB + 1, thumbnail: false })).toBe("file_too_large");
  });

  it("lets plans and videos go up at their own caps", () => {
    expect(uploadRefusal({ name: "plan.pdf", size: 99 * MB, thumbnail: false })).toBeNull();
    expect(uploadRefusal({ name: "walk.mov", size: 400 * MB, thumbnail: false })).toBeNull();
    expect(uploadRefusal({ name: "walk.mov", size: 501 * MB, thumbnail: false })).toBe("file_too_large");
  });

  it("takes only a light image as a thumbnail", () => {
    expect(uploadRefusal({ name: "t.webp", size: 2 * MB + 1, thumbnail: true })).toBe("file_too_large");
    expect(uploadRefusal({ name: "t.pdf", size: 1000, thumbnail: true })).toBe("file_type");
  });
});
