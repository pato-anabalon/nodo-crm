/**
 * A drawn signature, independent of the screen it was drawn on.
 *
 * Strokes are stored as SVG path data in one fixed box, 600×250, whatever the
 * size of the canvas: a signature drawn across a phone held sideways has to
 * land in the same place on the computer it is sent to. The shape is roughly
 * a signature line's — room to sign without the box dwarfing the form.
 *
 * Signatures saved before were in a 600×130 box. Nothing converts them:
 * wherever a stored signature is shown, it is framed by its own strokes
 * (`signatureViewBox`), so the box it was drawn in doesn't matter there.
 *
 * Kept free of anything server-only: the pads on both screens use it.
 */

export const SIGNATURE_BOX = { width: 600, height: 250 } as const;

/** The CSS aspect ratio a pad keeps, so the box scales the same both ways. */
export const SIGNATURE_ASPECT = `${SIGNATURE_BOX.width} / ${SIGNATURE_BOX.height}`;

/** Width over height, for sizing a pad by the height it may take. */
export const SIGNATURE_RATIO = SIGNATURE_BOX.width / SIGNATURE_BOX.height;

type Rect = { left: number; top: number; width: number; height: number };

/**
 * A pointer position on a canvas, in the signature box.
 *
 * Clamped to the box: the pad captures the pointer, so a stroke that runs off
 * the edge keeps reporting positions outside it.
 */
export function toBox(clientX: number, clientY: number, rect: Rect): { x: number; y: number } {
  const x = ((clientX - rect.left) / Math.max(rect.width, 1)) * SIGNATURE_BOX.width;
  const y = ((clientY - rect.top) / Math.max(rect.height, 1)) * SIGNATURE_BOX.height;
  return {
    x: Math.round(Math.min(Math.max(x, 0), SIGNATURE_BOX.width)),
    y: Math.round(Math.min(Math.max(y, 0), SIGNATURE_BOX.height)),
  };
}

/** One stroke as stored: `M10,20L11,22L13,25`. Strokes are joined by a space. */
export function strokeOf(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join("");
}

/** The strokes in a stored signature. */
export function splitStrokes(data: string): string[] {
  return data.split(" ").filter(Boolean);
}

const NUMBER = String.raw`-?\d+(?:\.\d+)?`;
const POINT = `${NUMBER},${NUMBER}`;
const STROKE = new RegExp(`^M${POINT}(?:L${POINT})*$`);

/**
 * Whether a value is strokes and nothing else.
 *
 * It ends up in the `d` of an SVG on the team's screen, and a phone posting to
 * the handoff is a request anybody could hand-craft. Path data is a small
 * language; this allows the two letters the pads write.
 */
export function isSignaturePath(value: string): boolean {
  if (value === "") return true;
  return splitStrokes(value).every((stroke) => STROKE.test(stroke));
}

/** The points of one stored stroke, in the signature box. */
function pointsOf(stroke: string): Array<{ x: number; y: number }> {
  return stroke
    .slice(1)
    .split("L")
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x, y };
    });
}

/**
 * Draws stored strokes onto a canvas of any size. The context is expected in
 * CSS pixels (already scaled for the device's pixel ratio).
 */
export function drawStrokes(
  context: Pick<CanvasRenderingContext2D, "beginPath" | "moveTo" | "lineTo" | "stroke">,
  data: string,
  size: { width: number; height: number },
): void {
  const sx = size.width / SIGNATURE_BOX.width;
  const sy = size.height / SIGNATURE_BOX.height;

  for (const stroke of splitStrokes(data)) {
    const points = pointsOf(stroke);
    if (points.length === 0) continue;
    context.beginPath();
    context.moveTo(points[0].x * sx, points[0].y * sy);
    for (const point of points.slice(1)) context.lineTo(point.x * sx, point.y * sy);
    context.stroke();
  }
}

/**
 * The viewBox that frames a stored signature by its own strokes, with a
 * margin. Independent of the box it was drawn in — which is what lets the
 * older 600×130 signatures and the current ones show side by side — and a
 * small signature fills its frame instead of sitting in one corner of it.
 */
export function signatureViewBox(data: string, margin = 10): string {
  const points = splitStrokes(data).flatMap(pointsOf);
  if (points.length === 0) return `0 0 ${SIGNATURE_BOX.width} ${SIGNATURE_BOX.height}`;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - margin;
  const minY = Math.min(...ys) - margin;
  // Never narrower than a line's height: a single dot or a flat stroke must
  // not be blown up to fill the frame.
  const width = Math.max(Math.max(...xs) - Math.min(...xs) + margin * 2, 60);
  const height = Math.max(Math.max(...ys) - Math.min(...ys) + margin * 2, 40);
  return `${minX} ${minY} ${width} ${height}`;
}

export type HandoffState = "ok" | "expired" | "closed";

/**
 * Whether a phone can still sign for a quote.
 *
 * Closed when the quote is no longer waiting for an answer or its link no
 * longer opens: signing for something that can't be accepted is a dead end.
 */
export function handoffState(
  handoff: { expiresAt: Date },
  quote: { status: string },
  shareOpen: boolean,
  now: Date = new Date(),
): HandoffState {
  if (quote.status !== "SENT" || !shareOpen) return "closed";
  if (handoff.expiresAt.getTime() <= now.getTime()) return "expired";
  return "ok";
}

/**
 * Where the signing line sits, as a fraction of the box's height from the
 * top. Only a guide drawn behind the canvas — nothing about it is stored.
 */
export const SIGNATURE_LINE = 0.78;

/** How long a QR stays good for. Long enough to find the phone, not longer. */
export const HANDOFF_MINUTES = 15;

/** How often the computer asks whether the phone sent anything new. */
export const HANDOFF_POLL_MS = 1500;

/**
 * Where the signature the customer accepted with was drawn.
 *
 * The phone's only when what was accepted is exactly what the phone sent:
 * drawing over it on the computer makes it this device's signature, because
 * that is where the last strokes came from.
 */
export function signatureDeviceFor(
  submitted: string,
  fromPhone: string | null,
): "TOUCH_DEVICE" | "THIS_DEVICE" {
  return fromPhone !== null && fromPhone !== "" && submitted === fromPhone
    ? "TOUCH_DEVICE"
    : "THIS_DEVICE";
}
