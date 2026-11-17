import { JobLocationSource } from "@/generated/prisma/enums";
import { geocode, regionOf } from "@/lib/geo/geocode";
import { addressMovedSincePin, locationPlan } from "../location";

const job = (over: Partial<Parameters<typeof locationPlan>[0]> = {}) => ({
  address: "12 Queen Street, Auckland",
  latitude: null,
  longitude: null,
  locationSource: null,
  geocodedAddress: null,
  ...over,
});
const placed = { latitude: -36.85, longitude: 174.76, locationSource: JobLocationSource.GEOCODED };

describe("locationPlan", () => {
  it("reads a new address", () => {
    expect(locationPlan(job())).toBe("geocode");
  });

  it("reads it again when the address changes", () => {
    expect(locationPlan(job({ ...placed, geocodedAddress: "10 Queen Street, Auckland" }))).toBe("geocode");
  });

  it("leaves the pin when the same address is saved again, spacing and case aside", () => {
    expect(locationPlan(job({ ...placed, geocodedAddress: "12  queen street, auckland " }))).toBe("keep");
  });

  it("doesn't ask again about an address that found nothing", () => {
    expect(locationPlan(job({ geocodedAddress: "12 Queen Street, Auckland" }))).toBe("keep");
  });

  it("never moves a pin placed by hand", () => {
    const byHand = job({ ...placed, locationSource: JobLocationSource.MANUAL, geocodedAddress: "Old address" });
    expect(locationPlan(byHand)).toBe("keep");
    expect(locationPlan({ ...byHand, address: null })).toBe("keep");
    expect(addressMovedSincePin(byHand)).toBe(true);
  });

  it("takes away a pin read from an address that is gone", () => {
    expect(locationPlan(job({ ...placed, address: "  ", geocodedAddress: "12 Queen Street" }))).toBe("clear");
    expect(locationPlan(job({ address: null }))).toBe("keep");
  });

  it("says nothing moved for a pin read from the address", () => {
    expect(addressMovedSincePin(job({ ...placed, geocodedAddress: "Elsewhere" }))).toBe(false);
  });
});

describe("geocode", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.GOOGLE_GEOCODING_API_KEY;
  });

  it("asks nothing without a key", async () => {
    global.fetch = jest.fn();
    expect(await geocode("12 Queen Street", "en-NZ")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("reads the first answer, biased to the company's country", async () => {
    process.env.GOOGLE_GEOCODING_API_KEY = "key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "OK", results: [{ geometry: { location: { lat: -36.85, lng: 174.76 } } }] }),
    });
    expect(await geocode("12 Queen Street", "en-NZ")).toEqual({ latitude: -36.85, longitude: 174.76 });
    const url = new URL(String((global.fetch as jest.Mock).mock.calls[0][0]));
    expect(url.searchParams.get("region")).toBe("nz");
    expect(url.searchParams.get("address")).toBe("12 Queen Street");
  });

  it("treats no result and a failure alike", async () => {
    process.env.GOOGLE_GEOCODING_API_KEY = "key";
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ZERO_RESULTS" }) });
    expect(await geocode("Nowhere", "en-NZ")).toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error("offline"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await geocode("12 Queen Street", "en-NZ")).toBeNull();
    warn.mockRestore();
  });

  it("finds the region in a format locale", () => {
    expect(regionOf("en-NZ")).toBe("nz");
    expect(regionOf("es")).toBeNull();
  });
});
