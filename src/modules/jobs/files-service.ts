import { del, head } from "@vercel/blob";
import type { CompanyContext } from "@/lib/auth/session";
import { JobActivityType } from "@/generated/prisma/enums";
import { fileRule, isBlobUrlFor, isUnderPrefix, jobUploadPrefix } from "./files";
import { subtreeIds } from "./folders";
import { logJobActivity } from "./service";

/**
 * Docs & Files: folders and the files in them.
 *
 * Every function takes the `jobId` the caller already confirmed through
 * `requireJobContext`, and every lookup of a folder or a file is filtered by
 * it — `ctx.db` keeps companies apart, this keeps jobs apart.
 */

const uploaderSelect = { id: true, name: true, email: true, image: true } as const;

/**
 * Docs & Files shows what was filed there. A post's or a comment's attachments
 * are the same table but live with what they were attached to.
 */
const filed = { postId: null, commentId: null } as const;

export const jobFileSelect = {
  id: true,
  folderId: true,
  name: true,
  url: true,
  contentType: true,
  size: true,
  width: true,
  height: true,
  thumbnailUrl: true,
  uploadedById: true,
  createdAt: true,
  uploadedBy: { select: uploaderSelect },
} as const;

export async function jobFolders(ctx: CompanyContext, jobId: string) {
  return ctx.db.jobFolder.findMany({
    where: { jobId },
    orderBy: { name: "asc" },
    select: { id: true, parentId: true, name: true, createdById: true },
  });
}

/** What sits directly inside a folder (or at the top, for null). */
export async function folderContents(ctx: CompanyContext, jobId: string, folderId: string | null) {
  const [folders, files] = await Promise.all([
    ctx.db.jobFolder.findMany({
      where: { jobId, parentId: folderId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        createdById: true,
        updatedAt: true,
        _count: { select: { files: true, children: true } },
      },
    }),
    ctx.db.jobFile.findMany({
      where: { jobId, folderId, ...filed },
      orderBy: { createdAt: "desc" },
      select: jobFileSelect,
    }),
  ]);
  return { folders, files };
}

/** Every file on the job, wherever it sits — what a filter by kind searches. */
export async function allJobFiles(ctx: CompanyContext, jobId: string) {
  return ctx.db.jobFile.findMany({ where: { jobId, ...filed }, orderBy: { createdAt: "desc" }, select: jobFileSelect });
}

export type JobFileRow = Awaited<ReturnType<typeof folderContents>>["files"][number];

/** How many files, and the latest photos — the Docs & Files card on the job's page. */
export async function filesSummary(ctx: CompanyContext, jobId: string) {
  const [count, images] = await Promise.all([
    ctx.db.jobFile.count({ where: { jobId, ...filed } }),
    ctx.db.jobFile.findMany({
      // A PDF has a cover too, but this card promises photos.
      where: { jobId, ...filed, thumbnailUrl: { not: null }, contentType: { startsWith: "image/" } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, thumbnailUrl: true },
    }),
  ]);
  return { count, images };
}

/** The files a timeline row mentions, those still there. */
export async function filesByIds(ctx: CompanyContext, ids: string[]) {
  if (ids.length === 0) return [];
  return ctx.db.jobFile.findMany({ where: { id: { in: ids } }, select: jobFileSelect });
}

export async function findFolder(ctx: CompanyContext, folderId: string) {
  return ctx.db.jobFolder.findFirst({ where: { id: folderId }, select: { id: true, jobId: true, name: true, createdById: true } });
}

/** A file filed in Docs — the only kind Docs' rename, move and delete reach. */
export async function findFile(ctx: CompanyContext, fileId: string) {
  return ctx.db.jobFile.findFirst({
    where: { id: fileId, ...filed },
    select: { id: true, jobId: true, name: true, uploadedById: true, url: true, thumbnailUrl: true },
  });
}

/** A folder id from a form is only good if it is a folder of *this* job. */
async function folderOfJob(ctx: CompanyContext, jobId: string, folderId: string | null): Promise<boolean> {
  if (!folderId) return true;
  return (await ctx.db.jobFolder.count({ where: { id: folderId, jobId } })) > 0;
}

export async function createFolder(
  ctx: CompanyContext,
  jobId: string,
  parentId: string | null,
  name: string,
): Promise<string | null> {
  if (!(await folderOfJob(ctx, jobId, parentId))) return null;
  const folder = await ctx.db.jobFolder.create({
    data: { companyId: ctx.company.id, jobId, parentId, name, createdById: ctx.user.id },
    select: { id: true },
  });
  await logJobActivity(ctx, jobId, JobActivityType.FOLDER_CREATED, { folderId: folder.id, name });
  return folder.id;
}

export async function renameFolder(ctx: CompanyContext, jobId: string, folderId: string, name: string) {
  await ctx.db.jobFolder.updateMany({ where: { id: folderId, jobId }, data: { name } });
}

/**
 * The folder and everything in it. The rows go first and the stored files
 * after: an orphan in the store costs kilobytes, a row pointing at a file
 * that is gone is a broken thumbnail on somebody's screen.
 */
export async function deleteFolder(ctx: CompanyContext, jobId: string, folderId: string) {
  const all = await ctx.db.jobFolder.findMany({ where: { jobId }, select: { id: true, parentId: true, name: true } });
  if (!all.some((folder) => folder.id === folderId)) return;
  const ids = subtreeIds(all, folderId);
  const files = await ctx.db.jobFile.findMany({
    where: { jobId, folderId: { in: ids } },
    select: { url: true, thumbnailUrl: true },
  });
  await ctx.db.jobFolder.deleteMany({ where: { id: folderId, jobId } });
  await deleteStored(files);
}

export type UploadedFile = {
  url: string;
  pathname: string;
  name: string;
  width: number | null;
  height: number | null;
  thumbnail: { url: string; pathname: string } | null;
};

export type RegisterOutcome = { ok: true; count: number } | { ok: false; reason: "folder" | "file" };

type VerifiedRow = {
  companyId: string;
  jobId: string;
  name: string;
  url: string;
  pathname: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
  thumbnailPathname: string | null;
  uploadedById: string;
};

/**
 * Turns what the browser says it just put in the store into rows ready to
 * write — or null, if any of it fails.
 *
 * Nothing the browser says about a file is taken on its word. The path must be
 * under this job's prefix and the URL must be the store's own for that path;
 * the size and type are read back from the store (`head`) rather than from the
 * request. A file that fails any of it fails the whole batch — a half-written
 * upload is harder to reason about than a refused one.
 */
export async function verifyUploads(
  ctx: CompanyContext,
  jobId: string,
  uploads: UploadedFile[],
): Promise<VerifiedRow[] | null> {
  const prefix = jobUploadPrefix(ctx.company.id, jobId);

  const verified: VerifiedRow[] = [];
  for (const upload of uploads) {
    const pathOk = isUnderPrefix(upload.pathname, prefix) && isBlobUrlFor(upload.url, upload.pathname);
    const thumbOk =
      !upload.thumbnail ||
      (isUnderPrefix(upload.thumbnail.pathname, `${prefix}thumbnails/`) &&
        isBlobUrlFor(upload.thumbnail.url, upload.thumbnail.pathname));
    if (!pathOk || !thumbOk || !fileRule(upload.pathname)) return null;

    const stored = await head(upload.url).catch(() => null);
    if (!stored) return null;

    verified.push({
      companyId: ctx.company.id,
      jobId,
      name: upload.name.trim().slice(0, 255) || upload.pathname.split("/").pop()!,
      url: stored.url,
      pathname: stored.pathname,
      contentType: stored.contentType,
      size: stored.size,
      width: upload.width && upload.width > 0 ? Math.round(upload.width) : null,
      height: upload.height && upload.height > 0 ? Math.round(upload.height) : null,
      thumbnailUrl: upload.thumbnail?.url ?? null,
      thumbnailPathname: upload.thumbnail?.pathname ?? null,
      uploadedById: ctx.user.id,
    });
  }
  return verified;
}

/** Writes the rows for files the browser has just put in the store, filed into Docs. */
export async function registerFiles(
  ctx: CompanyContext,
  jobId: string,
  folderId: string | null,
  uploads: UploadedFile[],
): Promise<RegisterOutcome> {
  if (!(await folderOfJob(ctx, jobId, folderId))) return { ok: false, reason: "folder" };
  const verified = await verifyUploads(ctx, jobId, uploads);
  if (!verified || verified.length === 0) return { ok: false, reason: "file" };

  const created = await ctx.db.jobFile.createManyAndReturn({
    data: verified.map((row) => ({ ...row, folderId })),
    select: { id: true },
  });
  await logJobActivity(ctx, jobId, JobActivityType.FILES_UPLOADED, {
    count: created.length,
    fileIds: created.slice(0, 8).map((file) => file.id),
    folderId,
  });
  return { ok: true, count: created.length };
}

/**
 * Attaches files to a post or a comment. No timeline line of its own: the
 * post or comment going out is the news, and its line says so.
 */
export async function attachFiles(
  ctx: CompanyContext,
  jobId: string,
  home: { postId: string } | { commentId: string },
  uploads: UploadedFile[],
): Promise<boolean> {
  if (uploads.length === 0) return true;
  const verified = await verifyUploads(ctx, jobId, uploads);
  if (!verified) return false;
  await ctx.db.jobFile.createMany({ data: verified.map((row) => ({ ...row, ...home })) });
  return true;
}

/**
 * Takes attachments off a post or a comment: only ones that are really its own,
 * whatever ids the form sent. Rows first, stored files after.
 */
export async function detachFiles(
  ctx: CompanyContext,
  home: { postId: string } | { commentId: string },
  fileIds: string[],
): Promise<void> {
  if (fileIds.length === 0) return;
  const files = await ctx.db.jobFile.findMany({
    where: { id: { in: fileIds }, ...home },
    select: { id: true, url: true, thumbnailUrl: true },
  });
  if (files.length === 0) return;
  await ctx.db.jobFile.deleteMany({ where: { id: { in: files.map((file) => file.id) } } });
  await deleteStored(files);
}

export async function renameFile(ctx: CompanyContext, jobId: string, fileId: string, name: string) {
  await ctx.db.jobFile.updateMany({ where: { id: fileId, jobId }, data: { name } });
}

export async function moveFile(
  ctx: CompanyContext,
  jobId: string,
  fileId: string,
  folderId: string | null,
): Promise<boolean> {
  if (!(await folderOfJob(ctx, jobId, folderId))) return false;
  const { count } = await ctx.db.jobFile.updateMany({ where: { id: fileId, jobId }, data: { folderId } });
  return count > 0;
}

export async function deleteFile(ctx: CompanyContext, jobId: string, fileId: string) {
  const file = await ctx.db.jobFile.findFirst({ where: { id: fileId, jobId }, select: { url: true, thumbnailUrl: true } });
  if (!file) return;
  await ctx.db.jobFile.deleteMany({ where: { id: fileId, jobId } });
  await deleteStored([file]);
}

/** Every stored file of a job — what deleting the job has to clear from the store. */
export async function storedFilesOfJob(ctx: CompanyContext, jobId: string) {
  return ctx.db.jobFile.findMany({ where: { jobId }, select: { url: true, thumbnailUrl: true } });
}

/** Best effort: a file left behind in the store is a cost, never an error on screen. */
export async function deleteStored(files: { url: string; thumbnailUrl: string | null }[]) {
  const urls = files.flatMap((file) => (file.thumbnailUrl ? [file.url, file.thumbnailUrl] : [file.url]));
  for (let i = 0; i < urls.length; i += 100) {
    await del(urls.slice(i, i + 100)).catch(() => undefined);
  }
}
