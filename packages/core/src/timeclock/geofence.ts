/**
 * Whether a phone is at the job: the rule the app applies the moment somebody
 * presses clock in, and the server applies again when the punch arrives. Pure,
 * so both sides read one answer and it is checked without a phone.
 */

export type Point = { latitude: number; longitude: number };

/** What a phone reports: where it thinks it is, and how sure it is, in metres. */
export type Fix = Point & { accuracyM: number };

/** The radius a job starts with, and the ones it may be given. */
export const DEFAULT_GEOFENCE_RADIUS_M = 300;
export const GEOFENCE_RADII_M = [200, 300, 400, 500] as const;

export function isGeofenceRadius(value: unknown): value is (typeof GEOFENCE_RADII_M)[number] {
  return GEOFENCE_RADII_M.includes(value as (typeof GEOFENCE_RADII_M)[number]);
}

const EARTH_RADIUS_M = 6_371_008.8;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in metres (haversine): at a few hundred metres it is right to the centimetre. */
export function distanceM(a: Point, b: Point): number {
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type GeofenceVerdict =
  /** Close enough: the punch is taken. */
  | { kind: "inside"; distanceM: number }
  /** Clearly away from the job: refused. */
  | { kind: "outside"; distanceM: number }
  /** The phone's guess is wider than the circle itself: wait for a better one. */
  | { kind: "imprecise"; distanceM: number }
  /** The job has no place on the map yet, so there is nothing to be inside. */
  | { kind: "no-site" };

/**
 * Inside when the circle the phone might be anywhere in touches the job's:
 * `distance − accuracy ≤ radius`. Somebody standing on site with a vague GPS
 * isn't turned away for it — but a guess wider than the radius proves nothing
 * either way, unless even its far edge is still inside.
 */
export function geofenceVerdict(site: Point | null, radiusM: number, fix: Fix): GeofenceVerdict {
  if (!site) return { kind: "no-site" };
  const distance = distanceM(site, fix);
  if (distance + fix.accuracyM <= radiusM) return { kind: "inside", distanceM: distance };
  if (fix.accuracyM > radiusM) return { kind: "imprecise", distanceM: distance };
  if (distance - fix.accuracyM <= radiusM) return { kind: "inside", distanceM: distance };
  return { kind: "outside", distanceM: distance };
}

/** A latitude and longitude that can be a place on Earth, or null. */
export function asPoint(latitude: unknown, longitude: unknown): Point | null {
  const lat = typeof latitude === "string" ? Number(latitude) : latitude;
  const lng = typeof longitude === "string" ? Number(longitude) : longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

/**
 * Coordinates pasted from a map — Google Maps copies `-36.8485, 174.7633` —
 * or null. The way to place a job by hand without a map on the screen.
 */
export function parseCoordinates(text: string): Point | null {
  const match = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  return match ? asPoint(Number(match[1]), Number(match[2])) : null;
}
