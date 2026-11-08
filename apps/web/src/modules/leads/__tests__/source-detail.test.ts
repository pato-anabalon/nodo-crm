import { LeadSource } from "@/generated/prisma/enums";
import { resolveSourceDetail } from "../source-detail";

const offered = ["Home show", "Billboard"];

describe("resolveSourceDetail", () => {
  it("keeps a detail the company offers when the source is Other", () => {
    expect(resolveSourceDetail({ source: LeadSource.OTHER, detail: "Home show", offered })).toBe("Home show");
  });

  it("drops it for any other source", () => {
    expect(resolveSourceDetail({ source: LeadSource.WEB, detail: "Home show", offered })).toBeNull();
  });

  it("drops a label the company never offered (hand-crafted post)", () => {
    expect(resolveSourceDetail({ source: LeadSource.OTHER, detail: "Made up", offered })).toBeNull();
  });

  it("keeps the lead's current value even after the option was removed", () => {
    expect(
      resolveSourceDetail({ source: LeadSource.OTHER, detail: "Old fair", offered, current: "Old fair" }),
    ).toBe("Old fair");
  });

  it("treats empty as none", () => {
    expect(resolveSourceDetail({ source: LeadSource.OTHER, detail: "", offered })).toBeNull();
    expect(resolveSourceDetail({ source: LeadSource.OTHER, detail: null, offered })).toBeNull();
  });
});
