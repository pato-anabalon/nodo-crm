import {
  canBecomeContact,
  contactDisplayName,
  normaliseEmail,
  splitPersonName,
} from "../identity";

describe("normaliseEmail", () => {
  it("matches the same person however they typed it", () => {
    expect(normaliseEmail("  Steve.Scott@Example.CO.NZ ")).toBe("steve.scott@example.co.nz");
  });

  it.each([null, undefined, "", "   "])("gives nothing back for %p", (value) => {
    // An absent address must never match anybody else's absent address.
    expect(normaliseEmail(value)).toBeNull();
  });
});

describe("splitPersonName", () => {
  it("takes the last word as the surname", () => {
    expect(splitPersonName("Steve Scott")).toEqual({ firstName: "Steve", lastName: "Scott" });
  });

  it("keeps a compound given name together", () => {
    expect(splitPersonName("Ana María Reyes")).toEqual({
      firstName: "Ana María",
      lastName: "Reyes",
    });
  });

  it("treats a single word as a given name, not a surname", () => {
    expect(splitPersonName("Steve")).toEqual({ firstName: "Steve", lastName: null });
  });

  it("copes with the spacing a form leaves behind", () => {
    expect(splitPersonName("  Steve   Scott  ")).toEqual({
      firstName: "Steve",
      lastName: "Scott",
    });
  });

  it("has nothing to split when nothing was typed", () => {
    expect(splitPersonName("   ")).toEqual({ firstName: "", lastName: null });
  });
});

describe("contactDisplayName", () => {
  it("joins the two parts", () => {
    expect(contactDisplayName({ firstName: "Steve", lastName: "Scott" })).toBe("Steve Scott");
  });

  it("leaves no trailing space when there is no surname", () => {
    expect(contactDisplayName({ firstName: "Steve", lastName: null })).toBe("Steve");
  });
});

describe("canBecomeContact", () => {
  it("accepts a lead that has a name and an address", () => {
    expect(canBecomeContact({ contactName: "Steve Scott", contactEmail: "s@e.test" })).toBe(true);
  });

  it("refuses one with no address", () => {
    // Without an address the next enquiry couldn't be recognised as the same
    // person, and every one of them would make another unconnected record.
    expect(canBecomeContact({ contactName: "Steve Scott", contactEmail: null })).toBe(false);
  });

  it("refuses one with no name", () => {
    expect(canBecomeContact({ contactName: "  ", contactEmail: "s@e.test" })).toBe(false);
  });
});
