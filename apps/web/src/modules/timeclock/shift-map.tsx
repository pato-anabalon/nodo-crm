"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { loadGoogleMaps, mapId, mapsKey } from "@/lib/geo/google-maps";
import { oklchToHex } from "@nodo/core/theme/color";
import type { Point } from "@nodo/core/timeclock/geofence";

/**
 * A shift on the map: the job's circle, where the phone was at clock-in and
 * clock-out, and the positions recorded in between as one line. Read only —
 * a supervisor looks at it to understand a day, not to move anything.
 */

export type ShiftMapProps = {
  site: (Point & { radiusM: number }) | null;
  clockIn: Point | null;
  clockOut: Point | null;
  track: Point[];
};

export function ShiftMap({ site, clockIn, clockOut, track }: ShiftMapProps) {
  const t = useTranslations("timesheets.shiftPage.map");
  const locale = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  useEffect(() => {
    let cancelled = false;
    const drawn: { setMap: (map: null) => void }[] = [];
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];
    loadGoogleMaps(locale)
      .then(async (maps) => {
        if (cancelled || !box.current) return;
        const [{ Map, Circle, Polyline }, { AdvancedMarkerElement, PinElement }, { ColorScheme, LatLngBounds }] = await Promise.all([
          maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
          maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
          maps.importLibrary("core") as Promise<google.maps.CoreLibrary>,
        ]);
        if (cancelled || !box.current) return;
        const at = (point: Point) => ({ lat: point.latitude, lng: point.longitude });
        const map = new Map(box.current, {
          mapId,
          colorScheme: dark ? ColorScheme.DARK : ColorScheme.LIGHT,
          gestureHandling: "cooperative",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        // The company's colour; the map takes hex, and the token is OKLCH.
        const brand = oklchToHex(getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()) ?? "#2563eb";
        const bounds = new LatLngBounds();

        if (site) {
          const circle = new Circle({
            map,
            center: at(site),
            radius: site.radiusM,
            clickable: false,
            strokeColor: brand,
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: brand,
            fillOpacity: 0.12,
          });
          drawn.push(circle);
          const circleBounds = circle.getBounds();
          if (circleBounds) bounds.union(circleBounds);
        }
        if (track.length > 1) {
          drawn.push(new Polyline({ map, path: track.map(at), strokeColor: brand, strokeOpacity: 0.8, strokeWeight: 3, clickable: false }));
        }
        track.forEach((point) => bounds.extend(at(point)));

        // Letters rather than colours alone: "in" and "out" read without telling two greens apart.
        const pin = (point: Point, glyph: string, title: string, background: string) => {
          const element = new PinElement({ glyph, glyphColor: "#ffffff", background, borderColor: background });
          markers.push(new AdvancedMarkerElement({ map, position: at(point), title, content: element }));
          bounds.extend(at(point));
        };
        if (clockIn) pin(clockIn, t("inGlyph"), t("clockIn"), "#15803d");
        if (clockOut) pin(clockOut, t("outGlyph"), t("clockOut"), "#b91c1c");

        if (bounds.isEmpty()) return;
        map.fitBounds(bounds, 32);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      drawn.forEach((shape) => shape.setMap(null));
      markers.forEach((marker) => (marker.map = null));
    };
    // The shift doesn't change while the page is open; the theme rebuilds it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  if (!mapsKey) return <p className="text-sm text-muted-foreground">{t("noMap")}</p>;
  if (failed) return <p className="text-sm text-muted-foreground">{t("failed")}</p>;
  return <div ref={box} className="h-72 w-full overflow-hidden rounded-lg bg-muted" role="region" aria-label={t("label")} />;
}
