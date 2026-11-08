import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/modules/documents/constants";
import { requireJobContext } from "@/modules/jobs/access";
import { canTouch } from "@/modules/jobs/rules";
import { extensionOf, fileFilterFromParam, jobUploadPrefix, kindOfContentType, matchesFilter, type FileFilter } from "@/modules/jobs/files";
import { folderPaths, folderTrail } from "@/modules/jobs/folders";
import { allJobFiles, folderContents, jobFolders, type JobFileRow } from "@/modules/jobs/files-service";
import {
  createFolderAction,
  deleteFileAction,
  deleteFolderAction,
  moveFileAction,
  moveFileToAction,
  registerJobFilesAction,
  renameFileAction,
  renameFolderAction,
} from "@/modules/jobs/files-actions";
import { JobUploader } from "@/modules/jobs/docs/job-uploader";
import { NewFolderButton } from "@/modules/jobs/docs/name-dialogs";
import { FileBrowser, type BrowserFile } from "@/modules/jobs/docs/file-browser";
import { CrumbDrop, FileDndProvider } from "@/modules/jobs/docs/file-dnd";

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata() {
  const t = await getTranslations("jobs.files");
  return { title: t("title") };
}

export default async function JobFilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { ctx, job } = await requireJobContext(id, "files.read");
  const t = await getTranslations("jobs.files");

  const folderId = typeof query.folder === "string" && query.folder ? query.folder : null;
  const view = query.view === "list" ? "list" : "grid";
  const filter = fileFilterFromParam(query.kind);

  const allFolders = await jobFolders(ctx, job.id);
  if (folderId && !allFolders.some((folder) => folder.id === folderId)) notFound();
  const trail = folderId ? folderTrail(allFolders, folderId) : [];

  // A filter looks across the whole job — "every photo of this job" is the
  // question it answers — so it shows no folders.
  const contents = filter
    ? { folders: [], files: (await allJobFiles(ctx, job.id)).filter((file) => matchesFilter(file.contentType, filter)) }
    : await folderContents(ctx, job.id, folderId);

  const base = `/jobs/${job.id}/files`;
  const href = (change: { folder?: string | null; view?: string; kind?: FileFilter | null }) => {
    const next = new URLSearchParams();
    const folder = change.folder === undefined ? folderId : change.folder;
    const kind = change.kind === undefined ? filter : change.kind;
    const nextView = change.view ?? view;
    if (folder && !kind) next.set("folder", folder);
    if (kind) next.set("kind", kind);
    if (nextView !== "grid") next.set("view", nextView);
    const qs = next.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const { formatLocale, timezone } = ctx.company;
  const canCreate = can(ctx, "files.create");
  const toBrowserFile = (file: JobFileRow): BrowserFile => ({
    id: file.id,
    folderId: file.folderId,
    name: file.name,
    url: file.url,
    kind: kindOfContentType(file.contentType),
    extension: extensionOf(file.name),
    sizeLabel: formatBytes(file.size, formatLocale),
    dateLabel: formatDate(file.createdAt, formatLocale, timezone),
    thumbnailUrl: file.thumbnailUrl,
    width: file.width,
    height: file.height,
    uploadedBy: file.uploadedBy,
    canUpdate: canTouch(ctx.user.id, ctx.permissions, "files.update", file.uploadedById),
    canDelete: canTouch(ctx.user.id, ctx.permissions, "files.delete", file.uploadedById),
  });

  const browser = (
    <FileBrowser
      view={view}
      emptyLabel={filter ? t("emptyFiltered") : canCreate ? t("emptyCanUpload") : t("empty")}
      folders={contents.folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        href: href({ folder: folder.id }),
        contents: t("contents", { files: folder._count.files, folders: folder._count.children }),
        canUpdate: canTouch(ctx.user.id, ctx.permissions, "files.update", folder.createdById),
        canDelete: canTouch(ctx.user.id, ctx.permissions, "files.delete", folder.createdById),
      }))}
      files={contents.files.map(toBrowserFile)}
      moveTargets={folderPaths(allFolders).map((folder) => ({ value: folder.id, label: folder.path }))}
      onRenameFile={renameFileAction}
      onMoveFile={moveFileAction}
      onDeleteFile={deleteFileAction}
      onRenameFolder={renameFolderAction}
      onDeleteFolder={deleteFolderAction}
    />
  );

  const filters: (FileFilter | null)[] = [null, "images", "videos", "documents"];

  // Everything on the job under the upload box: where we are, how to look at it, and what is there.
  const gallery = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Where we are: the job's Docs & Files, then each folder down to this one. */}
        <nav aria-label={t("breadcrumb")} className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
          <CrumbDrop folderId={null} current={trail.length === 0}>
            <Link href={href({ folder: null, kind: null })} draggable={false} className={cn("hover:underline", trail.length === 0 && !filter && "font-semibold")}>
              {t("title")}
            </Link>
          </CrumbDrop>
          {trail.map((folder, index) => (
            <span key={folder.id} className="flex items-center gap-1">
              <ChevronRight className="size-4 text-muted-foreground" />
              <CrumbDrop folderId={folder.id} current={index === trail.length - 1}>
                <Link href={href({ folder: folder.id, kind: null })} draggable={false} className={cn("hover:underline", index === trail.length - 1 && "font-semibold")}>
                  {folder.name}
                </Link>
              </CrumbDrop>
            </span>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5" role="group" aria-label={t("filterLabel")}>
            {filters.map((kind) => (
              <Link
                key={kind ?? "all"}
                href={href({ kind })}
                aria-current={filter === kind ? "true" : undefined}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                  filter === kind && "bg-muted text-foreground",
                )}
              >
                {t(`filter.${kind ?? "all"}`)}
              </Link>
            ))}
          </div>
          <div className="flex rounded-md border p-0.5" role="group" aria-label={t("viewLabel")}>
            {(["grid", "list"] as const).map((option) => {
              const Icon = option === "grid" ? LayoutGrid : List;
              return (
                <Link
                  key={option}
                  href={href({ view: option })}
                  aria-current={view === option ? "true" : undefined}
                  className={cn("rounded p-1.5 text-muted-foreground hover:text-foreground", view === option && "bg-muted text-foreground")}
                >
                  <Icon className="size-4" />
                  <span className="sr-only">{t(`view.${option}`)}</span>
                </Link>
              );
            })}
          </div>
          {canCreate && !filter ? <NewFolderButton action={createFolderAction.bind(null, job.id, folderId)} /> : null}
        </div>
      </div>
      {browser}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={`/jobs/${job.id}`} aria-label={t("backToJob", { name: job.name })}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="truncate text-sm text-muted-foreground">{job.name}</p>
        </div>
      </div>

      {/* Dropping on a folder moves a file; a filter spreads the job's files over every folder, so there is no "here" to drop them in. */}
      <FileDndProvider enabled={!filter} onMove={moveFileToAction}>
      {canCreate && !filter ? (
        <JobUploader
          jobId={job.id}
          prefix={jobUploadPrefix(ctx.company.id, job.id)}
          onRegister={registerJobFilesAction.bind(null, job.id, folderId)}
        >
          {gallery}
        </JobUploader>
      ) : (
        gallery
      )}
      </FileDndProvider>
    </div>
  );
}
