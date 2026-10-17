"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SIGNATURE_ASPECT, SIGNATURE_RATIO, drawStrokes, splitStrokes, strokeOf, toBox } from "./signature";
import { SignatureGuide } from "./signature-guide";

type SendState = "idle" | "sent" | "closed" | "failed";

/**
 * The phone's half of signing from a touch device.
 *
 * Every time a finger lifts, all the strokes so far go to the server, which
 * replaces what it had; the computer polls and redraws. Sending everything
 * rather than the last stroke is what makes a retry harmless and "Clear" a
 * plain empty send. One way only: nothing drawn on the computer comes back.
 *
 * Signing works upright too, but the box keeps the signature's 600×250 shape,
 * so on its side the phone gives it roughly twice the room — hence the
 * nudge to turn it, which disappears once it is turned.
 */
export function PhoneSignaturePad({ token, initialPaths }: { token: string; initialPaths: string }) {
  const t = useTranslations("portal.handoff");
  const tPortal = useTranslations("portal");
  const [inking, setInking] = useState(false);
  const [paths, setPaths] = useState<string[]>(() => splitStrokes(initialPaths));
  const [state, setState] = useState<SendState>(initialPaths ? "sent" : "idle");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{ active: boolean; points: Array<{ x: number; y: number }> }>({
    active: false,
    points: [],
  });

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    // Slightly heavier than the computer's pad, for a fingertip to see what it
    // drew. Only the look here: what is sent and stored is points, not width.
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
    context.clearRect(0, 0, rect.width, rect.height);
    drawStrokes(context, paths.join(" "), rect);
  }, [paths]);

  useEffect(() => {
    redraw();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    // Turning the phone resizes the box: redrawn from the strokes, which
    // don't depend on its size.
    const observer = new ResizeObserver(() => redraw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  async function send(next: string[]) {
    try {
      const response = await fetch(`/api/sign/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: next.join(" ") }),
      });
      if (response.status === 410 || response.status === 404) setState("closed");
      else if (response.ok) setState(next.length > 0 ? "sent" : "idle");
      else setState("failed");
    } catch {
      setState("failed");
    }
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    if (state === "closed") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = {
      active: true,
      points: [toBox(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())],
    };
    setInking(true);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current.active) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = toBox(event.clientX, event.clientY, rect);
    const previous = drawing.current.points.at(-1)!;
    drawing.current.points.push(point);
    const context = canvasRef.current?.getContext("2d");
    if (context) drawStrokes(context, strokeOf([previous, point]), rect);
  }

  function end() {
    if (!drawing.current.active) return;
    const points = drawing.current.points;
    drawing.current = { active: false, points: [] };
    setInking(false);
    if (points.length < 2) return;

    const next = [...paths, strokeOf(points)];
    setPaths(next);
    void send(next);
  }

  function clear() {
    setPaths([]);
    void send([]);
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground landscape:hidden">
        <RotateCw className="size-4 shrink-0" />
        {t("rotate")}
      </p>

      {/* As wide as it can be without running taller than most of the
          screen: a phone on its side is short, and a box that scrolls under
          the finger can't be signed in. */}
      <div
        className="relative mx-auto rounded-md bg-white"
        style={{ width: `min(100%, calc(70dvh * ${SIGNATURE_RATIO}))` }}
      >
        <SignatureGuide label={tPortal("signHere")} inked={inking || paths.length > 0} />
        <canvas
          ref={canvasRef}
          aria-label={t("phoneTitle")}
          style={{ aspectRatio: SIGNATURE_ASPECT }}
          className="relative block w-full touch-none rounded-md border bg-transparent"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium" role="status">
          {state === "sent"
            ? t("ready")
            : state === "closed"
              ? t("phoneUnavailableTitle")
              : state === "failed"
                ? t("failed")
                : t("drawHere")}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={paths.length === 0}>
          <X className="size-4" />
          {t("clear")}
        </Button>
      </div>
    </div>
  );
}
