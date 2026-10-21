// The service pulls in the notifier, which opens a database client on import.
jest.mock("@/modules/notifications/inbox", () => ({ notify: jest.fn() }));

import type { CompanyContext } from "@/lib/auth/session";
import { leadFiltersSchema } from "../schemas";
import { UNASSIGNED_FILTER, buildLeadWhere } from "../service";

function ctx(permissions: string[]): CompanyContext {
  return { user: { id: "me" }, permissions: new Set(permissions) } as unknown as CompanyContext;
}

const parse = (input: Record<string, unknown>) => leadFiltersSchema.parse(input);

describe("filtering leads by the person they're assigned to", () => {
  it("narrows to that person for someone who sees everyone's leads", () => {
    const where = buildLeadWhere(ctx(["leads.read.all"]), parse({ ownerId: "ana" }));
    expect(where.AND).toContainEqual({ ownerId: "ana" });
  });

  it("finds the leads nobody has yet", () => {
    const where = buildLeadWhere(ctx(["leads.read.all"]), parse({ ownerId: UNASSIGNED_FILTER }));
    expect(where.AND).toContainEqual({ ownerId: null });
  });

  it("adds nothing when no person is chosen", () => {
    const where = buildLeadWhere(ctx(["leads.read.all"]), parse({}));
    expect(JSON.stringify(where)).not.toContain("ownerId");
  });

  it("can never widen what a profile without read.all is allowed to see", () => {
    // The visibility rule stays at the top level and the filter only adds to it:
    // asking for somebody else's leads yields the intersection, which is empty.
    const where = buildLeadWhere(ctx([]), parse({ ownerId: "ana" }));
    expect(where.ownerId).toBe("me");
    expect(where.AND).toContainEqual({ ownerId: "ana" });
  });
});
