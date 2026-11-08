/**
 * Confetti, for the two moments in a quote's life worth marking: it went out,
 * and the customer said yes.
 *
 * Three rules shape everything here.
 *
 * **Nobody is celebrated over.** `prefers-reduced-motion: reduce` means no
 * confetti at all — not a gentler version. For someone who gets motion sickness
 * a smaller swarm of moving particles is still a swarm of moving particles.
 *
 * **Once, not once per visit.** A customer who accepts and opens the same link
 * next week is looking at the same "accepted" screen; a party every time would
 * be absurd. Anything with a `key` fires once per browser and then never again.
 *
 * **It is the company's colours, not a party shop's.** The palette is read from
 * the live CSS tokens at the moment it fires, so a company's brand colour is
 * what comes out — the same colour the rest of their quote is wearing.
 */

import { oklchToHex } from "@/lib/theme/color";

const STORAGE_PREFIX = "nodo.celebrated.";

export type Intensity = "small" | "full";

/**
 * The keys for "this quote was accepted", one per audience.
 *
 * They have to differ. The customer's portal lives on the company's own
 * subdomain — that is the point, so they see the branding — which means the
 * portal and the dashboard are **the same origin and share one
 * `localStorage`**. Under a single key, a customer accepting spent the team's
 * celebration before anybody on the team had seen it.
 *
 * Written here rather than at the two call sites so the next person cannot
 * retype one of them and quietly merge them again.
 */
export const acceptedKey = {
  customer: (quoteId: string) => `accepted:customer:${quoteId}`,
  staff: (quoteId: string) => `accepted:staff:${quoteId}`,
};

/** Where on the viewport a burst starts, as fractions from the top left. */
export type Origin = { x: number; y: number };

/**
 * The centre of an element, in the fractions canvas-confetti wants.
 *
 * Better than a hard-coded corner: the small burst answers a button, so it
 * should come out of that button wherever the layout happens to put it.
 */
export function originOf(element: Element): Origin {
  const box = element.getBoundingClientRect();
  return {
    x: (box.left + box.width / 2) / window.innerWidth,
    y: (box.top + box.height / 2) / window.innerHeight,
  };
}

/** The canvas is ours rather than the library's, so it can carry `no-print`. */
let canvas: HTMLCanvasElement | null = null;

function surface(): HTMLCanvasElement {
  if (canvas?.isConnected) return canvas;
  canvas = document.createElement("canvas");
  canvas.className = "no-print";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "60",
  });
  document.body.appendChild(canvas);
  return canvas;
}

/**
 * Any CSS colour to the hex the library needs.
 *
 * The tokens are `oklch(…)` — `BrandTheme` writes the company's colour in that
 * form — and canvas-confetti only parses hex. Handing the string to a canvas
 * context looks like it should work and doesn't: for a CSS Color 4 colour the
 * browser hands the same string straight back rather than an sRGB hex, so every
 * OKLCH token quietly resolved to its fallback and the confetti came out in the
 * defaults instead of the company's colours. `oklchToHex` does the conversion.
 *
 * The canvas is still worth trying for anything else a token might hold — an
 * `rgb()`, a named colour — but it is the last resort, not the first.
 */
function toHex(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(trimmed)) return trimmed;

  const converted = oklchToHex(trimmed);
  if (converted) return converted;

  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return fallback;
  ctx.fillStyle = fallback;
  ctx.fillStyle = trimmed;
  const resolved = ctx.fillStyle;
  return typeof resolved === "string" && resolved.startsWith("#") ? resolved : fallback;
}

function palette(intensity: Intensity): string[] {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) =>
    toHex(styles.getPropertyValue(name), fallback);

  const brand = token("--primary", "#2563eb");
  // Accepting is green everywhere else in this app; the confetti agrees.
  const accepted = token("--quote-accepted", "#04c604");

  return intensity === "small"
    ? [brand, token("--accent", "#93c5fd"), "#ffffff"]
    : [accepted, brand, token("--accent", "#93c5fd"), "#ffffff"];
}

function alreadyCelebrated(key: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key) !== null;
  } catch {
    // Private browsing, or storage turned off. Celebrating twice is a far
    // smaller problem than throwing on the way to a party.
    return false;
  }
}

function remember(key: string) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, String(Date.now()));
  } catch {
    /* see above */
  }
}

/**
 * Fires, unless it shouldn't. Returns whether it actually did, which is what
 * lets a caller mark the moment as spent without guessing.
 *
 * The library is imported here and nowhere else: the 3 KB only travels to
 * someone who is about to see it, and never to somebody who has turned motion
 * off or has already celebrated this.
 */
export async function celebrate({
  key,
  intensity = "full",
  origin,
}: { key?: string; intensity?: Intensity; origin?: Origin } = {}): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  if (key) {
    if (alreadyCelebrated(key)) return false;
    remember(key);
  }

  const { default: confetti } = await import("canvas-confetti");
  const fire = confetti.create(surface(), { resize: true, useWorker: true });
  const colors = palette(intensity);

  if (intensity === "small") {
    // A quote going out is routine — several a week. Short and small on
    // purpose: what is celebrated identically every time stops being a
    // celebration and becomes a tic.
    await fire({
      colors,
      particleCount: 70,
      // Bursts in every direction instead of firing upwards.
      //
      // canvas-confetti aims at 90° — straight up — unless told otherwise, and
      // this one starts at the Send button, near the top of the window. The
      // confetti left through the top edge almost immediately and only the
      // fraction that fell back was ever seen. Opening it right round keeps it
      // around the button that caused it, which is also what it is about.
      spread: 360,
      startVelocity: 26,
      gravity: 1.1,
      scalar: 0.9,
      ticks: 180,
      // Defaults to the top right, which is where the actions bar lives; the
      // caller normally hands over the button that was actually pressed.
      origin: origin ?? { x: 0.85, y: 0.16 },
      disableForReducedMotion: true,
    });
    return true;
  }

  // Two cannons from the bottom corners, three times over. This is the one that
  // means money, and it is allowed to look like it.
  //
  // `startVelocity` is the lever for how high they climb — the rest of the
  // numbers change how much there is, not how far it goes. It is set to clear
  // the top of the viewport rather than to peter out halfway up, which is what
  // made the first version read as two polite puffs.
  const cannon = (x: number, angle: number, delay: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(() => {
        void fire({
          colors,
          particleCount: 120,
          angle,
          spread: 85,
          startVelocity: 78,
          decay: 0.915,
          gravity: 0.95,
          scalar: 1.05,
          ticks: 300,
          origin: { x, y: 0.9 },
          disableForReducedMotion: true,
        });
        resolve();
      }, delay);
    });

  await Promise.all([
    cannon(0, 58, 0),
    cannon(1, 122, 0),
    cannon(0.12, 64, 210),
    cannon(0.88, 116, 210),
    cannon(0.28, 72, 430),
    cannon(0.72, 108, 430),
  ]);
  return true;
}
