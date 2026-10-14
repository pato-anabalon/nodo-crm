"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Download,
  DraftingCompass,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Film,
  Presentation,
  Folder,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Option } from "@/lib/intl/options";
import { cn } from "@/lib/utils";
import type { FileKind } from "../files";
import { PersonAvatar, type Person } from "../avatars";
import type { JobActionState } from "../actions";
import { Lightbox, type MediaItem } from "./lightbox";
import { MoveDialog, NameDialog } from "./name-dialogs";

export type BrowserFolder = {
  id: string;
  name: string;
  href: string;
  /** "4 files · 2 folders", already in the reader's words. */
  contents: string;
  canUpdate: boolean;
  canDelete: boolean;
};

export type BrowserFile = {
  id: string;
  folderId: string | null;
  name: string;
  url: string;
  kind: FileKind;
  extension: string;
  sizeLabel: string;
  dateLabel: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  uploadedBy: Person | null;
  canUpdate: boolean;
  canDelete: boolean;
};

type BoundAction = (id: string, state: JobActionState, formData: FormData) => Promise<JobActionState>;

/**
 * A folder's contents, as tiles or as a list. Photos, videos and PDFs open over
 * the page; anything else opens in its own tab — a browser can't draw a Word
 * file, and it hands it to whatever on the machine can.
 */
export function FileBrowser({
  folders,
  files,
  view,
  emptyLabel,
  moveTargets,
  onRenameFile,
  onMoveFile,
  onDeleteFile,
  onRenameFolder,
  onDeleteFolder,
}: {
  folders: BrowserFolder[];
  files: BrowserFile[];
  view: "grid" | "list";
  emptyLabel: string;
  moveTargets: Option[];
  onRenameFile: BoundAction;
  onMoveFile: BoundAction;
  onDeleteFile: (id: string) => Promise<JobActionState>;
  onRenameFolder: BoundAction;
  onDeleteFolder: (id: string) => Promise<JobActionState>;
}) {
  const t = useTranslations("jobs.files");
  const media: MediaItem[] = files
    .filter((file) => file.kind !== "document")
    .map((file) => ({
      id: file.id,
      name: file.name,
      url: file.url,
      kind: file.kind as MediaItem["kind"],
      width: file.width,
      height: file.height,
    }));
  const [open, setOpen] = useState<number | null>(null);

  function openFile(file: BrowserFile) {
    const index = media.findIndex((item) => item.id === file.id);
    if (index >= 0) setOpen(index);
    else window.open(file.url, "_blank", "noopener");
  }

  const menuProps = { moveTargets, onRenameFile, onMoveFile, onDeleteFile };

  if (folders.length === 0 && files.length === 0) {
    return <p className="rounded-lg border border-dashed p-8 text-center text-sm italic text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <>
      {view === "grid" ? (
        <div className="space-y-6">
          {folders.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {folders.map((folder) => (
                <li key={folder.id} className="group relative rounded-lg border bg-card transition-colors hover:bg-accent/40">
                  <Link href={folder.href} className="flex items-center gap-3 p-3 pr-10">
                    <Folder className="size-8 shrink-0 fill-amber-200 text-amber-500 dark:fill-amber-500/30" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{folder.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{folder.contents}</span>
                    </span>
                  </Link>
                  <FolderMenu folder={folder} onRename={onRenameFolder} onDelete={onDeleteFolder} className="absolute top-2 right-2" />
                </li>
              ))}
            </ul>
          ) : null}

          {files.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {files.map((file) => (
                <li key={file.id} className="group relative overflow-hidden rounded-lg border bg-card">
                  <button
                    type="button"
                    onClick={() => openFile(file)}
                    className="block w-full text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <div className="relative flex aspect-[4/3] items-center justify-center bg-muted">
                      {file.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- already a small copy made at upload.
                        <img
                          src={file.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          // A document's cover reads from the top: its title, not the middle of the page.
                          className={cn("size-full object-cover", file.kind === "pdf" && "object-top")}
                        />
                      ) : (
                        <DocumentTile kind={file.kind} extension={file.extension} />
                      )}
                      {file.kind === "video" ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="rounded-full bg-black/50 p-2 text-white">
                            <Play className="size-5 fill-current" />
                          </span>
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-0.5 p-2.5">
                      <p className="truncate text-sm font-medium" title={file.name}>
                        {file.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {file.sizeLabel} · {file.dateLabel}
                      </p>
                    </div>
                  </button>
                  <FileMenu
                    file={file}
                    {...menuProps}
                    className="absolute top-2 right-2 bg-background/80 opacity-100 backdrop-blur sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 data-[state=open]:opacity-100"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("uploadedBy")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("date")}</TableHead>
                <TableHead className="text-right">{t("size")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {folders.map((folder) => (
                <TableRow key={folder.id}>
                  <TableCell>
                    <Link href={folder.href} className="flex items-center gap-3 font-medium hover:underline">
                      <Folder className="size-5 shrink-0 fill-amber-200 text-amber-500 dark:fill-amber-500/30" />
                      {folder.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell" />
                  <TableCell className="hidden md:table-cell" />
                  <TableCell className="text-right text-muted-foreground">{folder.contents}</TableCell>
                  <TableCell>
                    <FolderMenu folder={folder} onRename={onRenameFolder} onDelete={onDeleteFolder} />
                  </TableCell>
                </TableRow>
              ))}
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>
                    <button type="button" onClick={() => openFile(file)} className="flex min-w-0 items-center gap-3 text-left hover:underline">
                      {file.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- already a small copy made at upload.
                        <img src={file.thumbnailUrl} alt="" loading="lazy" className="size-9 shrink-0 rounded object-cover" />
                      ) : (
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded", documentTone(file.kind, file.extension).tile)}>
                          <KindIcon kind={file.kind} extension={file.extension} className="size-4" />
                        </span>
                      )}
                      <span className="truncate font-medium">{file.name}</span>
                    </button>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {file.uploadedBy ? (
                      <span className="flex items-center gap-2">
                        <PersonAvatar person={file.uploadedBy} size="sm" />
                        <span className="truncate">{file.uploadedBy.name ?? file.uploadedBy.email}</span>
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{file.dateLabel}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{file.sizeLabel}</TableCell>
                  <TableCell>
                    <FileMenu file={file} {...menuProps} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}

      <Lightbox items={media} index={open} onIndexChange={setOpen} />
    </>
  );
}

/**
 * A file with no picture, told apart by colour: Word blue, Excel green,
 * PowerPoint orange, PDF red — the colours those programs already taught
 * everybody — and plans in slate. The extension is written large beside it,
 * so the colour is never the only thing saying what the file is.
 */
function DocumentTile({ kind, extension }: { kind: FileKind; extension: string }) {
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

function documentTone(kind: FileKind, extension: string): { tile: string } {
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

function FileMenu({
  file,
  moveTargets,
  onRenameFile,
  onMoveFile,
  onDeleteFile,
  className,
}: {
  file: BrowserFile;
  moveTargets: Option[];
  onRenameFile: BoundAction;
  onMoveFile: BoundAction;
  onDeleteFile: (id: string) => Promise<JobActionState>;
  className?: string;
}) {
  const t = useTranslations("jobs.files");
  const [dialog, setDialog] = useState<"rename" | "move" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className={className} disabled={pending}>
            <MoreHorizontal className="size-4" />
            <span className="sr-only">{t("actionsFor", { name: file.name })}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href={`${file.url}?download=1`}>
              <Download className="size-4" />
              {t("download")}
            </a>
          </DropdownMenuItem>
          {file.canUpdate ? (
            <>
              <DropdownMenuItem onSelect={() => setDialog("rename")}>
                <Pencil className="size-4" />
                {t("rename")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("move")}>
                <FolderInput className="size-4" />
                {t("move")}
              </DropdownMenuItem>
            </>
          ) : null}
          {file.canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                <Trash2 className="size-4" />
                {t("delete")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {file.canDelete ? (
        <ConfirmDelete
          open={dialog === "delete"}
          onOpenChange={(open) => setDialog(open ? "delete" : null)}
          title={t("deleteFileTitle", { name: file.name })}
          description={t("deleteFileBody")}
          confirmLabel={t("delete")}
          onConfirm={() =>
            startTransition(async () => {
              const result = await onDeleteFile(file.id);
              if (result.error) toast.error(result.error);
              else if (result.message) toast.success(result.message);
            })
          }
        />
      ) : null}

      {file.canUpdate ? (
        <>
          <NameDialog
            title={t("rename")}
            action={onRenameFile.bind(null, file.id)}
            defaultValue={file.name}
            open={dialog === "rename"}
            onOpenChange={(open) => setDialog(open ? "rename" : null)}
          />
          <MoveDialog
            action={onMoveFile.bind(null, file.id)}
            current={file.folderId}
            folders={moveTargets}
            open={dialog === "move"}
            onOpenChange={(open) => setDialog(open ? "move" : null)}
          />
        </>
      ) : null}
    </>
  );
}

function FolderMenu({
  folder,
  onRename,
  onDelete,
  className,
}: {
  folder: BrowserFolder;
  onRename: BoundAction;
  onDelete: (id: string) => Promise<JobActionState>;
  className?: string;
}) {
  const t = useTranslations("jobs.files");
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!folder.canUpdate && !folder.canDelete) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className={className} disabled={pending}>
            <MoreHorizontal className="size-4" />
            <span className="sr-only">{t("actionsFor", { name: folder.name })}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {folder.canUpdate ? (
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              <Pencil className="size-4" />
              {t("rename")}
            </DropdownMenuItem>
          ) : null}
          {folder.canUpdate && folder.canDelete ? <DropdownMenuSeparator /> : null}
          {folder.canDelete ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
              <Trash2 className="size-4" />
              {t("delete")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {folder.canUpdate ? (
        <NameDialog
          title={t("rename")}
          action={onRename.bind(null, folder.id)}
          defaultValue={folder.name}
          open={renaming}
          onOpenChange={setRenaming}
        />
      ) : null}
      {folder.canDelete ? (
        <ConfirmDelete
          open={confirming}
          onOpenChange={setConfirming}
          title={t("deleteFolderTitle", { name: folder.name })}
          description={t("deleteFolderBody", { contents: folder.contents })}
          confirmLabel={t("delete")}
          onConfirm={() =>
            startTransition(async () => {
              const result = await onDelete(folder.id);
              if (result.error) toast.error(result.error);
              else if (result.message) toast.success(result.message);
            })
          }
        />
      ) : null}
    </>
  );
}

/** `ConfirmButton`'s question, opened from a menu item rather than its own trigger. */
function ConfirmDelete({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const tCommon = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{tCommon("cancel")}</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
