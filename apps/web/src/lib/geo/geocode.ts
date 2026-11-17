import type { Point } from "@nodo/core/timeclock/geofence";

/**
 * An address on the map, through Google's Geocoding API. Asked only when a
 * job's address changes, never when it is read — each call is billed, and an
 * address read back gives the same answer it gave the first time.
 *
 * `GOOGLE_GEOCODING_API_KEY` is a server key (restricted to this API, not by
 * referrer: there is no browser here). Without it nothing is asked, and a job
 * is placed by hand. A failure of any kind is the same as no answer: the job
 * keeps no place, and the screen says so rather than the save failing.
 */
export async function geocode(address: string, formatLocale: string): Promise<Point | null> {
  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key || !address.trim()) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);
  // The company's own country first: "12 Queen Street" is in Auckland before it is in Brisbane.
  const region = regionOf(formatLocale);
  if (region) url.searchParams.set("region", region);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as GeocodeResponse;
    if (body.status !== "OK") {
      if (body.status !== "ZERO_RESULTS") console.warn(`[geocode] ${body.status}: ${body.error_message ?? ""}`);
      return null;
    }
    const location = body.results?.[0]?.geometry?.location;
    return location ? { latitude: location.lat, longitude: location.lng } : null;
  } catch (error) {
    console.warn("[geocode] failed", error);
    return null;
  }
}

type GeocodeResponse = {
  status: string;
  error_message?: string;
  results?: { geometry?: { location?: { lat: number; lng: number } } }[];
};

/** `en-NZ` → `nz`: the region a bias is asked for in. */
export function regionOf(formatLocale: string): string | null {
  try {
    return new Intl.Locale(formatLocale).region?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}
