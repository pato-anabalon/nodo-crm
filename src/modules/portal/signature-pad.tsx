"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignatureType } from "@/generated/prisma/enums";

/**
 * The customer's signature: drawn or typed, as in Quotient.
 *
 * What's drawn is stored as SVG strokes rather than a PNG: a fraction of the
 * weight, rescalable for the PDF without losing sharpness, and readable when
 * inspecting the database.
 */
export function SignaturePad({ required }: { required: boolean }) {
  const t = useTranslations("portal");
  const [mode, setMode] = useState<SignatureType>(SignatureType.DRAWN);
  const [typed, setTyped] = useState("");
  const [paths, setPaths] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{ active: boolean; points: string[] }>({ active: false, points: [] });

  const value = mode === SignatureType.TYPED ? typed : paths.join(" ");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== SignatureType.DRAWN) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    // The canvas is drawn at device resolution so the stroke doesn't look
    // pixelated on retina screens.
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    context.scale(ratio, ratio);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
  }, [mode]);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.round(event.clientX - rect.left),
      y: Math.round(event.clientY - rect.top),
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = pointFrom(event);
    drawing.current = { active: true, points: [`M${x},${y}`] };

    const context = canvasRef.current?.getContext("2d");
    context?.beginPath();
    context?.moveTo(x, y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current.active) return;
    const { x, y } = pointFrom(event);
    drawing.current.points.push(`L${x},${y}`);

    const context = canvasRef.current?.getContext("2d");
    context?.lineTo(x, y);
    context?.stroke();
  }

  function end() {
    if (!drawing.current.active) return;
    // A tap without a drag isn't a stroke: discarded.
    if (drawing.current.points.length > 1) {
      setPaths((current) => [...current, drawing.current.points.join("")]);
    }
    drawing.current = { active: false, points: [] };
  }

  function clear() {
    setPaths([]);
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
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

      {mode === SignatureType.DRAWN ? (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            aria-label={t("signature")}
            className="h-32 w-full touch-none rounded-md border bg-background"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
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
