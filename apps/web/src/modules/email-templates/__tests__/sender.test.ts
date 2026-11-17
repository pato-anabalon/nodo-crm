import { SenderNameStyle } from "@/generated/prisma/enums";
import { senderName } from "../sender";

const acme = { companyName: "PlasterPro Solution Limited", connector: "de" };

describe("senderName", () => {
  it("uses the company when that is the shape", () => {
    expect(senderName(SenderNameStyle.COMPANY, { ...acme, userName: "Rolando Reveco" })).toBe(
      "PlasterPro Solution Limited",
    );
  });

  it("uses the person's full name on its own", () => {
    expect(senderName(SenderNameStyle.USER, { ...acme, userName: "Rolando Reveco" })).toBe(
      "Rolando Reveco",
    );
  });

  /** As Quotient does: the combined form already runs long. */
  it("uses only the first name when combined with the company", () => {
    expect(
      senderName(SenderNameStyle.USER_AND_COMPANY, { ...acme, userName: "Rolando Reveco" }),
    ).toBe("Rolando de PlasterPro Solution Limited");
  });

  it("takes the connector it is given, because the customer reads it", () => {
    expect(
      senderName(SenderNameStyle.USER_AND_COMPANY, {
        ...acme,
        connector: "from",
        userName: "Rolando Reveco",
      }),
    ).toBe("Rolando from PlasterPro Solution Limited");
  });

  /**
   * A nightly follow-up has no sender. The company is who it is from either
   * way, and the alternative is a blank From line.
   */
  it.each([null, undefined, "", "   "])("falls back to the company when the person is %p", (name) => {
    for (const style of Object.values(SenderNameStyle)) {
      expect(senderName(style, { ...acme, userName: name })).toBe("PlasterPro Solution Limited");
    }
  });

  it("copes with a one-word name", () => {
    expect(senderName(SenderNameStyle.USER_AND_COMPANY, { ...acme, userName: "Rolando" })).toBe(
      "Rolando de PlasterPro Solution Limited",
    );
  });
});
