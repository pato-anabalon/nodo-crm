"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { AlertTriangle, ExternalLink, MapPin, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmButton } from "@/components/confirm-button";
import { useActionToast } from "@/lib/use-action-toast";
import { loadGoogleMaps, mapId, mapsKey } from "@/lib/geo/google-maps";
import { googleMapsUrl } from "@nodo/core/maps-link";
import { oklchToHex } from "@nodo/core/theme/color";
import { GEOFENCE_RADII_M, parseCoordinates, type Point } from "@nodo/core/timeclock/geofence";
import type { JobActionState } from "./actions";

export type JobLocation = {
  point: Point | null;
  source: "GEOCODED" | "MANUAL" | null;
  radiusM: number;
  /** A pin placed by hand whose address has changed since. */
  addressMoved: boolean;
};

/**
 * Where the job is on the map and how near counts as being there — what the
 * clock measures a punch against. Read from the address on its own; here it
 * is checked, dragged where the site really is, or given a wider circle.
 */
export function JobLocationCard({
  location,
  hasAddress,
  save,
  placeFromAddress,
  clear,
}: {
  location: JobLocation;
  hasAddress: boolean;
  save: (state: JobActionState, formData: FormData) => Promise<JobActionState>;
  placeFromAddress: () => Promise<JobActionState>;
  clear: () => Promise<JobActionState>;
}) {
  const t = useTranslations("jobs.location");
  const [editing, setEditing] = useState(false);
  const [busy, startTransition] = useTransition();

  const run = (action: () => Promise<JobActionState>) =>
    startTransition(async () => {
      const result = await action();
      if (result.message) toast.success(result.message);
      if (result.error) toast.error(result.error);
    });

  const status = location.point
    ? t(location.source === "MANUAL" ? "placedByHand" : "readFromAddress")
    : t(hasAddress ? "notFoundYet" : "noPlace");

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <MapPin className="size-5 text-muted-foreground" />
        <h2 className="font-semibold">{t("title")}</h2>
        {!editing ? (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            {t("adjust")}
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {status}
        {location.point ? ` · ${t("radius", { metres: location.radiusM })}` : null}
      </p>
      {!location.point ? <p className="text-sm text-muted-foreground">{t("whyItMatters")}</p> : null}

      {location.addressMoved ? (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 p-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">{t("addressMoved")}</span>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run(placeFromAddress)}>
            {t("useAddress")}
          </Button>
        </div>
      ) : null}

      {editing ? (
        <LocationEditor
          location={location}
          save={save}
          onDone={() => setEditing(false)}
          extra={
            <>
              {hasAddress && location.source !== "GEOCODED" ? (
                <Button type="button" variant="outline" disabled={busy} onClick={() => run(placeFromAddress)}>
                  {t("useAddress")}
                </Button>
              ) : null}
              {location.point ? (
                <ConfirmButton
                  trigger={
                    <Button type="button" variant="ghost" disabled={busy}>
                      {t("clear")}
                    </Button>
                  }
                  title={t("clearTitle")}
                  description={t("clearBody")}
                  confirmLabel={t("clear")}
                  onConfirm={() => run(clear)}
                />
              ) : null}
            </>
          }
        />
      ) : location.point ? (
        <>
          {mapsKey ? <SiteMap point={location.point} radiusM={location.radiusM} onOpen={() => openInMaps(location.point!)} /> : null}
          <OpenInMaps point={location.point} />
        </>
      ) : null}
    </section>
  );
}

/**
 * The site for whoever can't place it: the same map, read only, and the way
 * to get there — a tap on the map or the link opens Google Maps, which on a
 * phone is the app with directions one press away.
 */
export function JobLocationView({ point, radiusM }: { point: Point; radiusM: number }) {
  const t = useTranslations("jobs.location");
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <MapPin className="size-5 text-muted-foreground" />
        <h2 className="font-semibold">{t("title")}</h2>
      </div>
      {mapsKey ? <SiteMap point={point} radiusM={radiusM} onOpen={() => openInMaps(point)} /> : null}
      <OpenInMaps point={point} />
    </section>
  );
}

const openInMaps = (point: Point) => window.open(googleMapsUrl(point), "_blank", "noopener,noreferrer");

function OpenInMaps({ point }: { point: Point }) {
  const t = useTranslations("jobs.location");
  return (
    <Button asChild variant="outline" size="sm">
      <a href={googleMapsUrl(point)} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="size-4" />
        {t("openInMaps")}
      </a>
    </Button>
  );
}

function LocationEditor({
  location,
  save,
  onDone,
  extra,
}: {
  location: JobLocation;
  save: (state: JobActionState, formData: FormData) => Promise<JobActionState>;
  onDone: () => void;
  extra: React.ReactNode;
}) {
  const t = useTranslations("jobs.location");
  const tCommon = useTranslations("common");
  const [radius, setRadius] = useState(location.radiusM);
  // Set only once the pin is dragged or the map clicked: an untouched pin read from the address stays read from it.
  const [moved, setMoved] = useState<Point | null>(null);
  const [typed, setTyped] = useState("");
  const typedPoint = parseCoordinates(typed);
  const [state, formAction, pending] = useActionState(async (prev: JobActionState, formData: FormData) => {
    const next = await save(prev, formData);
    if (next.message) onDone();
    return next;
  }, {});
  useActionToast(state);

  const shown = typedPoint ?? moved ?? location.point;
  const radii = GEOFENCE_RADII_M.includes(location.radiusM as (typeof GEOFENCE_RADII_M)[number])
    ? GEOFENCE_RADII_M
    : [...GEOFENCE_RADII_M, location.radiusM].sort((a, b) => a - b);

  return (
    <form action={formAction} className="space-y-4">
      {mapsKey ? (
        shown ? (
          <>
            <SiteMap
              point={shown}
              radiusM={radius}
              onMove={(point) => {
                setTyped("");
                setMoved(point);
              }}
            />
            <p className="text-xs text-muted-foreground">{t("dragHint")}</p>
          </>
        ) : null
      ) : (
        <p className="text-sm text-muted-foreground">{t("noMap")}</p>
      )}
      {moved && !typedPoint ? (
        <>
          <input type="hidden" name="latitude" value={moved.latitude} />
          <input type="hidden" name="longitude" value={moved.longitude} />
        </>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="job-coordinates">{t("coordinates")}</Label>
          <Input
            id="job-coordinates"
            name="coordinates"
            inputMode="decimal"
            placeholder="-36.8485, 174.7633"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            aria-describedby="job-coordinates-hint"
          />
          <p id="job-coordinates-hint" className="text-xs text-muted-foreground">
            {t("coordinatesHint")}
          </p>
          {state.fieldErrors?.coordinates ? (
            <p className="text-sm text-destructive">{state.fieldErrors.coordinates[0]}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="job-radius">{t("radiusLabel")}</Label>
          <NativeSelect
            id="job-radius"
            name="radius"
            value={String(radius)}
            onChange={(event) => setRadius(Number(event.target.value))}
            options={radii.map((metres) => ({ value: String(metres), label: t("radiusOption", { metres }) }))}
          />
          <p className="text-xs text-muted-foreground">{t("radiusHint")}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || (typed !== "" && !typedPoint)}>
          {pending ? tCommon("saving") : tCommon("saveChanges")}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {tCommon("cancel")}
        </Button>
        <span className="ml-auto flex flex-wrap gap-2">{extra}</span>
      </div>
    </form>
  );
}

/**
 * The pin and its circle. With `onMove` the pin can be dragged, or put
 * somewhere else with a click; without it the map only shows, and a click
 * on it is `onOpen`.
 */
function SiteMap({
  point,
  radiusM,
  onMove,
  onOpen,
}: {
  point: Point;
  radiusM: number;
  onMove?: (point: Point) => void;
  onOpen?: () => void;
}) {
  const t = useTranslations("jobs.location");
  const locale = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const parts = useRef<{ map: google.maps.Map; marker: google.maps.marker.AdvancedMarkerElement; circle: google.maps.Circle } | null>(null);
  const [failed, setFailed] = useState(false);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const editable = Boolean(onMove);
  const moveRef = useRef(onMove);
  const openRef = useRef(onOpen);
  useEffect(() => {
    moveRef.current = onMove;
    openRef.current = onOpen;
  }, [onMove, onOpen]);

  // The map is built once per theme — a map's colour scheme is fixed when it is made.
  useEffect(() => {
    let cancelled = false;
    const listeners: google.maps.MapsEventListener[] = [];
    loadGoogleMaps(locale)
      .then(async (maps) => {
        if (cancelled || !box.current) return;
        const [{ Map, Circle }, { AdvancedMarkerElement }, { ColorScheme }] = await Promise.all([
          maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
          maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
          maps.importLibrary("core") as Promise<google.maps.CoreLibrary>,
        ]);
        if (cancelled || !box.current) return;
        const center = { lat: point.latitude, lng: point.longitude };
        const map = new Map(box.current, {
          center,
          zoom: 16,
          mapId,
          colorScheme: dark ? ColorScheme.DARK : ColorScheme.LIGHT,
          gestureHandling: "cooperative",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        const marker = new AdvancedMarkerElement({ map, position: center, gmpDraggable: editable, title: t("pin") });
        // The company's colour; the map takes hex, and the token is OKLCH.
        const brand = oklchToHex(getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()) ?? "#2563eb";
        const circle = new Circle({
          map,
          center,
          radius: radiusM,
          clickable: false,
          strokeColor: brand,
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: brand,
          fillOpacity: 0.12,
        });
        const moveTo = (latLng: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined) => {
          if (!latLng) return;
          const lat = typeof latLng.lat === "function" ? latLng.lat() : latLng.lat;
          const lng = typeof latLng.lng === "function" ? latLng.lng() : latLng.lng;
          moveRef.current?.({ latitude: lat, longitude: lng });
        };
        if (editable) {
          listeners.push(marker.addListener("dragend", () => moveTo(marker.position)));
          listeners.push(map.addListener("click", (event: google.maps.MapMouseEvent) => moveTo(event.latLng)));
        } else {
          listeners.push(map.addListener("click", () => openRef.current?.()));
          listeners.push(marker.addListener("click", () => openRef.current?.()));
        }
        parts.current = { map, marker, circle };
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      listeners.forEach((listener) => listener.remove());
      parts.current?.circle.setMap(null);
      if (parts.current) parts.current.marker.map = null;
      parts.current = null;
    };
    // Built again only when the theme or editability changes; moves and radius are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark, editable]);

  useEffect(() => {
    const current = parts.current;
    if (!current) return;
    const center = { lat: point.latitude, lng: point.longitude };
    current.marker.position = center;
    current.circle.setCenter(center);
    current.circle.setRadius(radiusM);
    if (!current.map.getBounds()?.contains(center)) current.map.panTo(center);
  }, [point.latitude, point.longitude, radiusM]);

  if (failed) return <p className="text-sm text-muted-foreground">{t("mapFailed")}</p>;
  return <div ref={box} className="h-64 w-full overflow-hidden rounded-lg bg-muted" role="region" aria-label={t("mapLabel")} />;
}
