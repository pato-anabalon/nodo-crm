import type { Point } from "./geofence";

/**
 * A shift's track once its positions are past the company's retention: the
 * line kept on the shift so the map still shows roughly where the day went,
 * in a few hundred bytes. Simplified (Douglas–Peucker, in metres) and then
 * written as an encoded polyline — the format Google's own maps read — at
 * five decimals, a metre or so, which is finer than any phone's fix.
 */

/** How far a simplified line may stray from the positions it replaces. */
export const TRACK_TOLERANCE_M = 15;

/** How long positions are kept, and the choices a company has. */
export const DEFAULT_LOCATION_RETENTION_DAYS = 180;
export const LOCATION_RETENTION_DAYS_OPTIONS = [30, 90, 180, 365] as const;

const METRES_PER_DEGREE = 111_320;

/**
 * Douglas–Peucker over a local flat projection: at the scale of a working
 * day, a few kilometres, treating the earth as flat costs millimetres. The
 * first and last positions are always kept.
 */
export function simplifyTrack(points: readonly Point[], toleranceM = TRACK_TOLERANCE_M): Point[] {
  if (points.length <= 2) return [...points];
  const origin = points[0]!;
  const cos = Math.cos((origin.latitude * Math.PI) / 180);
  const xy = points.map((p) => ({
    x: (p.longitude - origin.longitude) * METRES_PER_DEGREE * cos,
    y: (p.latitude - origin.latitude) * METRES_PER_DEGREE,
  }));

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  // A stack rather than recursion: a long day of positions can't overflow it.
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let furthest = -1;
    let furthestM = toleranceM;
    for (let i = first + 1; i < last; i++) {
      const d = distanceToSegment(xy[i]!, xy[first]!, xy[last]!);
      if (d > furthestM) {
        furthest = i;
        furthestM = d;
      }
    }
    if (furthest !== -1) {
      keep[furthest] = true;
      stack.push([first, furthest], [furthest, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

type XY = { x: number; y: number };

function distanceToSegment(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Google's encoded polyline, precision 5. */
export function encodeTrack(points: readonly Point[]): string {
  let out = "";
  let lastLat = 0;
  let lastLng = 0;
  for (const point of points) {
    const lat = Math.round(point.latitude * 1e5);
    const lng = Math.round(point.longitude * 1e5);
    out += encodeValue(lat - lastLat) + encodeValue(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

function encodeValue(value: number): string {
  let rest = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (rest >= 0x20) {
    out += String.fromCharCode((0x20 | (rest & 0x1f)) + 63);
    rest >>= 5;
  }
  return out + String.fromCharCode(rest + 63);
}

/** The line back as positions; a string that isn't one gives what could be read before it broke. */
export function decodeTrack(encoded: string): Point[] {
  const points: Point[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = (): number | null => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) return null;
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || shift > 30) return null;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    const dLat = next();
    const dLng = next();
    if (dLat === null || dLng === null) break;
    lat += dLat;
    lng += dLng;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

/** The line kept for a shift's positions: simplified, then encoded. Null when there is nothing to draw. */
export function thinTrack(points: readonly Point[], toleranceM = TRACK_TOLERANCE_M): string | null {
  if (points.length === 0) return null;
  return encodeTrack(simplifyTrack(points, toleranceM));
}
