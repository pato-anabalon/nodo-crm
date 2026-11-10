"use client";

/**
 * Google's Maps JavaScript API, loaded once and only by a screen that draws a
 * map — nobody else pays for the script. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is
 * a browser key, restricted by referrer to the company subdomains; it is a
 * different key from the server's geocoding one.
 */

let loading: Promise<typeof google.maps> | null = null;

export const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/** Advanced markers need a map id; Google's demo one draws the default style. */
export const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (!mapsKey) return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set"));
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const callback = "__nodoMapsReady";
    (window as unknown as Record<string, () => void>)[callback] = () => resolve(window.google.maps);
    const script = document.createElement("script");
    const params = new URLSearchParams({ key: mapsKey, v: "weekly", loading: "async", libraries: "marker", callback });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error("Google Maps failed to load"));
    };
    document.head.append(script);
  });
  return loading;
}
