import type { Point } from "./timeclock/geofence";

/**
 * A place opened in Google Maps — the app on a phone, the site on a computer —
 * by Maps URLs, the one form Google documents as stable. By coordinates rather
 * than the address: the pin is where the site really is, which a typed address
 * isn't always.
 */
export function googleMapsUrl(point: Point): string {
  const query = `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
