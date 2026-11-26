"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { loadGoogleMaps, mapId, mapsKey } from "@/lib/geo/google-maps";
import { oklchToHex } from "@nodo/core/theme/color";
import type { Point } from "@nodo/core/timeclock/geofence";
import { trackRuns } from "@nodo/core/timeclock/track";

/**
 * A shift on the map: the job's circle, where the phone was at clock-in and
 * clock-out, and the positions recorded in between as one line — solid in the
 * company's colour on the job, dashed and red away from it (`trackRuns`), so
 * the two read apart without telling colours apart. Read only — a supervisor
 * looks at it to understand a day, not to move anything.
 */

/** Away from the job: a red that holds on the light and the dark map alike, whatever the company's colour. */
const AWAY = "#dc2626";

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
        for (const run of trackRuns(track, site)) {
          if (run.points.length < 2) continue;
          const path = run.points.map(at);
          if (!run.away) {
            drawn.push(new Polyline({ map, path, strokeColor: brand, strokeOpacity: 0.8, strokeWeight: 3, clickable: false }));
            continue;
          }
          // A dashed line is a hidden stroke with a dash repeated along it.
          const dash = { path: "M 0,-1 0,1", strokeColor: AWAY, strokeOpacity: 0.9, strokeWeight: 3, scale: 3 };
          drawn.push(new Polyline({ map, path, strokeOpacity: 0, clickable: false, icons: [{ icon: dash, offset: "0", repeat: "14px" }] }));
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
  const away = trackRuns(track, site).some((run) => run.away && run.points.length > 1);
  return (
    <div className="space-y-2">
      <div ref={box} className="h-72 w-full overflow-hidden rounded-lg bg-muted" role="region" aria-label={t("label")} />
      {away ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-5 rounded-full bg-primary" />
            {t("onJob")}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="w-5 border-t-2 border-dashed" style={{ borderColor: AWAY }} />
            {t("away")}
          </li>
        </ul>
      ) : null}
    </div>
  );
}
