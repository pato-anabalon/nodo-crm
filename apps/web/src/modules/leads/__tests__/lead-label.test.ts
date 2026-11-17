import { leadOptionLabel } from "../lead-label";

describe("leadOptionLabel", () => {
  it("leads with the contact, then the title, then the company", () => {
    expect(
      leadOptionLabel({ title: "Kitchen replaster", contactName: "Paula Rivas", companyName: "Scott Builders" }),
    ).toBe("Paula Rivas - Kitchen replaster - Scott Builders");
  });

  it("drops missing pieces without leaving stray separators", () => {
    expect(leadOptionLabel({ title: "Kitchen replaster", contactName: "Paula Rivas", companyName: null })).toBe(
      "Paula Rivas - Kitchen replaster",
    );
    expect(leadOptionLabel({ title: "Kitchen replaster", contactName: null, companyName: "Scott Builders" })).toBe(
      "Kitchen replaster - Scott Builders",
    );
    expect(leadOptionLabel({ title: "Kitchen replaster" })).toBe("Kitchen replaster");
  });
});
