import { leaveLinks, platformName, readLinks, type ReviewPlatform } from "../review-platforms";
import { reviewPlatformSchema } from "../schemas";

const google: ReviewPlatform = {
  source: "GOOGLE",
  label: null,
  readUrl: "https://www.google.com/maps/place/PlasterPro+Solution+Ltd",
  leaveUrl: "https://g.page/r/CWZb6p_x4DOdEAE/review",
};

// The real pair: one page, two anchors, and swapping them sends the customer
// to the wrong one.
const nocowboys: ReviewPlatform = {
  source: "NOCOWBOYS",
  label: null,
  readUrl: "https://www.nocowboys.co.nz/businesses/plasterpro-solution#ratings",
  leaveUrl: "https://www.nocowboys.co.nz/businesses/plasterpro-solution#rate",
};

describe("which link goes where", () => {
  it("lists the reading links under the reviews", () => {
    expect(readLinks([google, nocowboys])).toEqual([
      { name: "Google", url: google.readUrl },
      { name: "NoCowboys", url: nocowboys.readUrl },
    ]);
  });

  it("hands the leaving links to the review request email", () => {
    expect(leaveLinks([google, nocowboys]).map((link) => link.url)).toEqual([
      google.leaveUrl,
      nocowboys.leaveUrl,
    ]);
  });

  it("never stands one link in for the other", () => {
    const readOnly = { ...google, leaveUrl: null };
    const leaveOnly = { ...nocowboys, readUrl: null };
    expect(readLinks([readOnly, leaveOnly]).map((link) => link.name)).toEqual(["Google"]);
    expect(leaveLinks([readOnly, leaveOnly]).map((link) => link.name)).toEqual(["NoCowboys"]);
  });

  it("keeps the company's own order", () => {
    expect(readLinks([nocowboys, google]).map((link) => link.name)).toEqual(["NoCowboys", "Google"]);
  });
});

describe("platformName", () => {
  it("names a known platform by itself", () => {
    expect(platformName({ source: "FACEBOOK", label: null }, "https://facebook.com/x")).toBe("Facebook");
  });

  it("names somewhere else by what the company called it", () => {
    expect(platformName({ source: "OTHER", label: "Builderscrack" }, "https://x.test")).toBe(
      "Builderscrack",
    );
  });

  it("falls back to the address for an unnamed one saved before names existed", () => {
    expect(
      platformName({ source: "OTHER", label: null }, "https://www.builderscrack.co.nz/tradies/x"),
    ).toBe("builderscrack.co.nz");
  });
});

describe("reviewPlatformSchema", () => {
  const parse = (values: Record<string, string>) =>
    reviewPlatformSchema.safeParse({ label: "", readUrl: "", leaveUrl: "", ...values });

  it("accepts a platform with only a reading link", () => {
    const result = parse({ source: "GOOGLE", readUrl: google.readUrl! });
    expect(result.success && result.data).toEqual({
      source: "GOOGLE",
      label: null,
      readUrl: google.readUrl,
      leaveUrl: null,
    });
  });

  it("refuses a platform with neither link", () => {
    const result = parse({ source: "GOOGLE" });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.flatten().fieldErrors.readUrl).toEqual([
      "settings.errors.oneLinkRequired",
    ]);
  });

  it("asks for a name when the platform is somewhere else", () => {
    const result = parse({ source: "OTHER", readUrl: "https://builderscrack.co.nz/x" });
    expect(!result.success && result.error.flatten().fieldErrors.label).toEqual([
      "settings.errors.platformNameRequired",
    ]);
  });

  it("drops a name left over from switching away from somewhere else", () => {
    const result = parse({ source: "GOOGLE", label: "Builderscrack", readUrl: google.readUrl! });
    expect(result.success && result.data.label).toBeNull();
  });

  it("refuses an address that isn't a web link", () => {
    const result = parse({ source: "GOOGLE", readUrl: "javascript:alert(1)" });
    expect(!result.success && result.error.flatten().fieldErrors.readUrl).toEqual([
      "settings.errors.invalidUrl",
    ]);
  });
});
