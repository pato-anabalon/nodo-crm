import { DraftingCompass, File as FileIcon, FileSpreadsheet, FileText, Film, Folder, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileKind } from "../files";

/**
 * A file with no picture, told apart by colour: Word blue, Excel green,
 * PowerPoint orange, PDF red — the colours those programs already taught
 * everybody — and plans in slate. The extension is written large beside it,
 * so the colour is never the only thing saying what the file is.
 */
export function DocumentTile({ kind, extension }: { kind: FileKind; extension: string }) {
  const tone = documentTone(kind, extension);
  // A video already carries the play button in the middle; the dark ground is enough.
  if (kind === "video") return <span className={cn("size-full", tone.tile)} />;
  return (
    <span className={cn("flex size-full flex-col items-center justify-center gap-2", tone.tile)}>
      <KindIcon kind={kind} extension={extension} className="size-9" />
      {extension ? <span className="text-sm font-bold tracking-wider uppercase">{extension}</span> : null}
    </span>
  );
}

const TONES = {
  word: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  sheet: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  slides: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  pdf: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  plan: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  video: "bg-neutral-800 text-white/70",
  other: "bg-muted text-muted-foreground",
} as const;

export function documentTone(kind: FileKind, extension: string): { tile: string } {
  if (kind === "video") return { tile: TONES.video };
  if (kind === "pdf") return { tile: TONES.pdf };
  if (["doc", "docx"].includes(extension)) return { tile: TONES.word };
  if (["xls", "xlsx", "csv"].includes(extension)) return { tile: TONES.sheet };
  if (["ppt", "pptx"].includes(extension)) return { tile: TONES.slides };
  if (["dwg", "dxf"].includes(extension)) return { tile: TONES.plan };
  return { tile: TONES.other };
}

export function KindIcon({ kind, extension, className }: { kind: FileKind; extension: string; className?: string }) {
  if (kind === "video") return <Film className={className} />;
  if (kind === "pdf") return <FileText className={className} />;
  if (["xls", "xlsx", "csv"].includes(extension)) return <FileSpreadsheet className={className} />;
  if (["ppt", "pptx"].includes(extension)) return <Presentation className={className} />;
  if (["dwg", "dxf"].includes(extension)) return <DraftingCompass className={className} />;
  if (["doc", "docx", "txt"].includes(extension)) return <FileText className={className} />;
  return <FileIcon className={className} />;
}

/** A folder, the same amber wherever it is drawn: the browser, the list and the job's card. */
export function FolderGlyph({ className }: { className?: string }) {
  return <Folder className={cn("shrink-0 fill-amber-200 text-amber-500 dark:fill-amber-500/30", className)} />;
}
