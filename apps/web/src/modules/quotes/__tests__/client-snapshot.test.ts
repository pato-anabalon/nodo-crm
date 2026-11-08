import { clientSnapshot } from "../service";

jest.mock("@/lib/db/prisma", () => ({ prisma: {} }));

describe("clientSnapshot", () => {
  it("copies the lead's contact details onto the quote's fields", () => {
    expect(
      clientSnapshot({
        contactName: "Paula Rivas",
        contactEmail: "paula@example.com",
        contactPhone: "021 555 0101",
        companyName: "Scott Builders",
      }),
    ).toEqual({
      clientName: "Paula Rivas",
      clientEmail: "paula@example.com",
      clientPhone: "021 555 0101",
      clientCompanyName: "Scott Builders",
    });
  });

  it("clears every field when there is no lead, rather than keeping the previous one's", () => {
    expect(clientSnapshot(null)).toEqual({
      clientName: null,
      clientEmail: null,
      clientPhone: null,
      clientCompanyName: null,
    });
  });
});
