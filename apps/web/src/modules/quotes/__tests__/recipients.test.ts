import {
  canRemoveRecipient,
  joinNames,
  primaryRecipientFrom,
  recipientName,
  sortRecipients,
} from "../recipients";

describe("primaryRecipientFrom", () => {
  it("takes the lead's person, with the address the way contacts are matched on", () => {
    expect(
      primaryRecipientFrom({ contactName: "Paula Rivas", contactEmail: " Paula@Example.COM ", contactId: "c1" }),
    ).toEqual({ name: "Paula Rivas", email: "paula@example.com", contactId: "c1" });
  });

  it("names somebody with no name by their address — the portal has to call them something", () => {
    expect(primaryRecipientFrom({ contactName: "  ", contactEmail: "ops@site.nz" })).toEqual({
      name: "ops@site.nz",
      email: "ops@site.nz",
      contactId: null,
    });
  });

  it("is nobody without an address, or without a lead", () => {
    expect(primaryRecipientFrom({ contactName: "Paula", contactEmail: null })).toBeNull();
    expect(primaryRecipientFrom({ contactName: "Paula", contactEmail: "  " })).toBeNull();
    expect(primaryRecipientFrom(null)).toBeNull();
  });
});

describe("joinNames", () => {
  it("greets everybody in one phrase, in the quote's language", () => {
    expect(joinNames(["Ana", "Bruno", "Carla"], "en-GB")).toBe("Ana, Bruno and Carla");
    expect(joinNames(["Ana", "Bruno", "Carla"], "es")).toBe("Ana, Bruno y Carla");
  });

  it("reads naturally for one and two", () => {
    expect(joinNames(["Ana"], "en-GB")).toBe("Ana");
    expect(joinNames(["Ana", "Bruno"], "en-GB")).toBe("Ana and Bruno");
  });

  it("drops blanks rather than leaving a stray comma", () => {
    expect(joinNames(["Ana", " ", ""], "en-GB")).toBe("Ana");
    expect(joinNames([], "en-GB")).toBe("");
  });
});

describe("sortRecipients", () => {
  it("puts the primary first and the copies in the order they were added", () => {
    const sorted = sortRecipients([
      { id: "b", isPrimary: false, position: 2 },
      { id: "p", isPrimary: true, position: 5 },
      { id: "a", isPrimary: false, position: 1 },
    ]);
    expect(sorted.map((row) => row.id)).toEqual(["p", "a", "b"]);
  });
});

describe("canRemoveRecipient", () => {
  const recipients = [
    { id: "p", isPrimary: true },
    { id: "c", isPrimary: false },
  ];

  it("lets a copy go", () => {
    expect(canRemoveRecipient(recipients, "c")).toBe("ok");
  });

  it("keeps the primary — a quote with copies and no 'For' is addressed to nobody", () => {
    expect(canRemoveRecipient(recipients, "p")).toBe("primary");
  });

  it("refuses a recipient that isn't on this quote", () => {
    expect(canRemoveRecipient(recipients, "someone-elses")).toBe("not-found");
  });
});

describe("recipientName", () => {
  it("joins what there is", () => {
    expect(recipientName("Ana", "Pérez")).toBe("Ana Pérez");
    expect(recipientName(" Ana ", null)).toBe("Ana");
  });
});
