import { asPoint, distanceM, geofenceVerdict, isGeofenceRadius, parseCoordinates } from "../geofence";

// Auckland's Sky Tower, and points a known distance north of it.
const site = { latitude: -36.84846, longitude: 174.7622 };
const metresNorth = (m: number) => ({ latitude: site.latitude + m / 111_195, longitude: site.longitude });

describe("distanceM", () => {
  it("measures a few hundred metres to within a metre", () => {
    expect(distanceM(site, metresNorth(300))).toBeCloseTo(300, 0);
    expect(distanceM(site, site)).toBe(0);
  });

  it("is the same both ways", () => {
    const other = { latitude: -36.9, longitude: 174.8 };
    expect(distanceM(site, other)).toBeCloseTo(distanceM(other, site), 6);
  });
});

describe("geofenceVerdict", () => {
  it("takes a sharp fix on site", () => {
    expect(geofenceVerdict(site, 300, { ...metresNorth(50), accuracyM: 10 }).kind).toBe("inside");
  });

  it("doesn't turn away somebody whose vague fix still touches the circle", () => {
    expect(geofenceVerdict(site, 300, { ...metresNorth(380), accuracyM: 100 }).kind).toBe("inside");
  });

  it("refuses a sharp fix clearly away", () => {
    const verdict = geofenceVerdict(site, 300, { ...metresNorth(800), accuracyM: 20 });
    expect(verdict.kind).toBe("outside");
    expect(verdict.kind === "outside" && Math.round(verdict.distanceM)).toBe(800);
  });

  it("asks to wait when the guess is wider than the circle", () => {
    expect(geofenceVerdict(site, 300, { ...metresNorth(900), accuracyM: 1500 }).kind).toBe("imprecise");
  });

  it("still takes a wide guess whose far edge is inside", () => {
    expect(geofenceVerdict(site, 2000, { ...metresNorth(10), accuracyM: 1500 }).kind).toBe("inside");
  });

  it("has nothing to be inside without a site", () => {
    expect(geofenceVerdict(null, 300, { ...site, accuracyM: 5 })).toEqual({ kind: "no-site" });
  });
});

describe("coordinates", () => {
  it("reads what a map copies", () => {
    expect(parseCoordinates("-36.8485, 174.7633")).toEqual({ latitude: -36.8485, longitude: 174.7633 });
    expect(parseCoordinates(" -36.8485 174.7633 ")).toEqual({ latitude: -36.8485, longitude: 174.7633 });
  });

  it("refuses what can't be a place", () => {
    expect(parseCoordinates("174.7633, -136.8")).toBeNull();
    expect(parseCoordinates("Queen Street")).toBeNull();
    expect(asPoint("12", "x")).toBeNull();
    expect(asPoint(Number.NaN, 1)).toBeNull();
  });

  it("knows the radii on offer", () => {
    expect(isGeofenceRadius(300)).toBe(true);
    expect(isGeofenceRadius(350)).toBe(false);
  });
});
