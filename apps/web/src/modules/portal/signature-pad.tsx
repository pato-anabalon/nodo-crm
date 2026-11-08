"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignatureType } from "@/generated/prisma/enums";
import { SignatureGuide } from "./signature-guide";
import {
  HANDOFF_POLL_MS,
  SIGNATURE_ASPECT,
  drawStrokes,
  strokeOf,
  toBox,
} from "./signature";

export type HandoffStarter = () => Promise<{ id: string; qrSvg: string } | { error: string }>;

/**
 * The customer's signature: drawn or typed, as in Quotient.
 *
 * What's drawn is stored as SVG strokes rather than a PNG: a fraction of the
 * weight, rescalable without losing sharpness, and readable when inspecting
 * the database. The strokes live in a fixed 600×250 box (`signature.ts`), so
 * the canvas keeps that shape and is redrawn from them whenever they change —
 * which is also how a signature sent from a phone appears here.
 *
 * `handoff` is absent where nothing can be signed for real (a test, a
 * preview); with it, "Sign from a touch device" shows a QR and mirrors what
 * the phone draws, one way.
 */
export function SignaturePad({
  required,
  handoff,
}: {
  required: boolean;
  handoff?: { start: HandoffStarter; pollBase: string };
}) {
  const t = useTranslations("portal");
  const [mode, setMode] = useState<SignatureType>(SignatureType.DRAWN);
  const [typed, setTyped] = useState("");
  const [paths, setPaths] = useState<string[]>([]);
  // True from the first touch of a stroke, so the "Sign here" guide gets out
  // of the way as the pen lands rather than when it lifts.
  const [inking, setInking] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{ active: boolean; points: Array<{ x: number; y: number }> }>({
    active: false,
    points: [],
  });

  // The phone handoff: which one is live, and whether its QR is on screen.
  const [phone, setPhone] = useState<{ id: string; qrSvg: string } | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const value = mode === SignatureType.TYPED ? typed : paths.join(" ");

  /** Sizes the canvas to its box at device resolution and redraws the strokes. */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
    context.clearRect(0, 0, rect.width, rect.height);
    drawStrokes(context, paths.join(" "), rect);
  }, [paths]);

  useEffect(() => {
    if (mode !== SignatureType.DRAWN || showQr) return;
    redraw();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => redraw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [mode, showQr, redraw]);

  /*
   * Asks the server for the phone's strokes while a handoff is live and the
   * tab is visible. Every newer version replaces what is on the pad — the
   * phone is the source while it is in use; drawing here doesn't go back.
   */
  useEffect(() => {
    if (!handoff || !phone || mode !== SignatureType.DRAWN) return;
    let version = 0;
    let stopped = false;

    const tick = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const response = await fetch(
          `${handoff.pollBase}/${encodeURIComponent(phone.id)}?v=${version}`,
          { cache: "no-store" },
        );
        if (response.status === 410 || response.status === 404) {
          stopped = true;
          setPhone(null);
          setShowQr(false);
          return;
        }
        if (response.status !== 200) return;
        const body = (await response.json()) as { paths: string; version: number };
        version = body.version;
        setPaths(body.paths.split(" ").filter(Boolean));
        // The first strokes are the cue: back to the pad, showing them.
        setShowQr(false);
      } catch {
        // A dropped poll is retried on the next tick.
      }
    };

    const timer = window.setInterval(tick, HANDOFF_POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [handoff, phone, mode]);

  async function signFromPhone() {
    if (!handoff) return;
    setStarting(true);
    setPhoneError(null);
    const result = await handoff.start();
    setStarting(false);
    if ("error" in result) {
      setPhoneError(result.error);
      return;
    }
    setPhone(result);
    setShowQr(true);
  }

  function stopPhone() {
    setPhone(null);
    setShowQr(false);
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toBox(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    drawing.current = { active: true, points: [point] };
    setInking(true);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current.active) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = toBox(event.clientX, event.clientY, rect);
    const previous = drawing.current.points.at(-1)!;
    drawing.current.points.push(point);

    // Drawn straight away rather than through state, so the line follows the
    // pointer without a render per move.
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    drawStrokes(context, strokeOf([previous, point]), rect);
  }

  function end() {
    if (!drawing.current.active) return;
    // A tap without a drag isn't a stroke: discarded.
    if (drawing.current.points.length > 1) {
      const stroke = strokeOf(drawing.current.points);
      setPaths((current) => [...current, stroke]);
    }
    drawing.current = { active: false, points: [] };
    setInking(false);
  }

  function clear() {
    setPaths([]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>
          {t("signature")}
          {required ? " *" : ""}
        </Label>
        <div className="flex gap-1">
          {[SignatureType.DRAWN, SignatureType.TYPED].map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={mode === option ? "secondary" : "ghost"}
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
            >
              {option === SignatureType.DRAWN ? t("signatureDraw") : t("signatureType")}
            </Button>
          ))}
        </div>
      </div>

      <input type="hidden" name="signatureType" value={mode} />
      <input type="hidden" name="signatureData" value={value} />
      {/* Which handoff the strokes may have come from; the server decides
          whether they still match what the phone sent. */}
      <input type="hidden" name="signatureHandoffId" value={phone?.id ?? ""} />

      {mode === SignatureType.DRAWN && showQr && phone ? (
        <div className="flex flex-col gap-5 rounded-md border bg-background p-4 sm:flex-row sm:items-center">
          <div
            className="mx-auto size-44 shrink-0 bg-white p-1 [&_svg]:size-full"
            role="img"
            aria-label={t("handoff.qrLabel")}
            // Our own SVG, drawn on the server by `qrcode` from our own URL.
            dangerouslySetInnerHTML={{ __html: phone.qrSvg }}
          />
          <div className="space-y-2 text-sm">
            <p className="text-base font-semibold">{t("handoff.title")}</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>{t("handoff.step1")}</li>
              <li>{t("handoff.step2")}</li>
              <li>{t("handoff.step3")}</li>
            </ol>
            <p>{t("handoff.autoUpdate")}</p>
            <Button type="button" size="sm" variant="outline" onClick={stopPhone}>
              {t("handoff.cancel")}
            </Button>
          </div>
        </div>
      ) : mode === SignatureType.DRAWN ? (
        <div className="space-y-2">
          {handoff ? (
            <div className="flex justify-end">
              {phone ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Smartphone className="size-3.5" />
                  {t("handoff.mirroring")}
                  <Button type="button" size="sm" variant="link" className="h-auto p-0 text-xs" onClick={stopPhone}>
                    {t("handoff.stop")}
                  </Button>
                </p>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  disabled={starting}
                  onClick={signFromPhone}
                >
                  <Smartphone className="size-3.5" />
                  {t("handoff.open")}
                </Button>
              )}
            </div>
          ) : null}
          {phoneError ? <p className="text-sm text-destructive">{phoneError}</p> : null}
          <div className="relative rounded-md bg-background">
            <SignatureGuide label={t("signHere")} inked={inking || paths.length > 0} />
            <canvas
              ref={canvasRef}
              aria-label={t("signature")}
              style={{ aspectRatio: SIGNATURE_ASPECT }}
              className="relative block w-full touch-none rounded-md border bg-transparent"
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{t("signatureHint")}</p>
            <Button type="button" size="sm" variant="ghost" onClick={clear}>
              {t("signatureClear")}
            </Button>
          </div>
        </div>
      ) : (
        <Input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={t("signaturePlaceholder")}
          className="font-serif text-xl italic"
          maxLength={120}
        />
      )}
    </div>
  );
}
