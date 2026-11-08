"use client";

import { useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type MediaItem = {
  id: string;
  name: string;
  url: string;
  kind: "image" | "video" | "pdf";
  width: number | null;
  height: number | null;
};

/**
 * Photos, videos and PDFs, one at a time, over the page. Arrows move through
 * them in the order the folder shows them — the way somebody goes through the
 * photos and plans from a day on site.
 *
 * The full photo is loaded only here; the grid behind shows the thumbnails. A
 * PDF is shown by the browser's own reader, which on desktop beats anything we
 * would build; a phone that won't draw one inline has the link to open it.
 */
export function Lightbox({
  items,
  index,
  onIndexChange,
}: {
  items: MediaItem[];
  /** Null when closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const t = useTranslations("jobs.files");
  const item = index === null ? null : items[index];
  const count = items.length;

  const step = useCallback(
    (by: number) => {
      if (index === null || count < 2) return;
      onIndexChange((index + by + count) % count);
    },
    [index, count, onIndexChange],
  );

  useEffect(() => {
    if (index === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, step]);

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent className="flex h-[92vh] max-w-[calc(100%-1rem)] flex-col gap-3 bg-neutral-950 p-3 text-white sm:max-w-[min(96vw,1400px)] [&>[data-slot=dialog-close]]:text-white">
        {item ? (
          <>
            <div className="flex min-w-0 items-center gap-3 pr-10">
              <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</DialogTitle>
              <DialogDescription className="shrink-0 text-xs text-white/60">
                {t("position", { current: (index ?? 0) + 1, total: count })}
              </DialogDescription>
              {item.kind === "pdf" ? (
                <Button asChild variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={t("openInTab")}>
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              ) : null}
              <Button asChild variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white">
                <a href={`${item.url}?download=1`} aria-label={t("download")}>
                  <Download className="size-4" />
                </a>
              </Button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center">
              {item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- a stored file at its own size; next/image would only add a hop.
                <img
                  key={item.id}
                  src={item.url}
                  alt={item.name}
                  width={item.width ?? undefined}
                  height={item.height ?? undefined}
                  className="max-h-full max-w-full object-contain"
                />
              ) : item.kind === "pdf" ? (
                <iframe key={item.id} src={item.url} title={item.name} className="size-full rounded bg-white" />
              ) : (
                <video key={item.id} src={item.url} controls playsInline className="max-h-full max-w-full" />
              )}

              {count > 1 ? (
                <>
                  <NavButton side="left" label={t("previous")} onClick={() => step(-1)} />
                  <NavButton side="right" label={t("next")} onClick={() => step(1)} />
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NavButton({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white ${side === "left" ? "left-2" : "right-2"}`}
    >
      <Icon className="size-6" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
