"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireCompanyContext } from "@/lib/auth/session";
import { translateFieldErrors } from "@/lib/i18n-errors";
import { requireJobContext } from "./access";
import { canTouch } from "./rules";
import type { JobActionState } from "./actions";
import {
  createFolder,
  deleteFile,
  deleteFolder,
  findFile,
  findFolder,
  moveFile,
  registerFiles,
  renameFile,
  renameFolder,
  type UploadedFile,
} from "./files-service";

const nameSchema = z.string().trim().min(1, "validation.required").max(255);

function refresh(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/jobs/${jobId}/files`);
}

/**
 * Records what the browser just uploaded. The token the upload route handed
 * out already limited where and what; this checks it all again, because the
 * list arrives from the browser like anything else does.
 */
export async function registerJobFilesAction(
  jobId: string,
  folderId: string | null,
  uploads: UploadedFile[],
): Promise<JobActionState> {
  const { ctx } = await requireJobContext(jobId, "files.create");
  const t = await getTranslations("jobs.files");

  const outcome = await registerFiles(ctx, jobId, folderId, uploads);
  if (!outcome.ok) return { error: t(`registerErrors.${outcome.reason}`) };

  refresh(jobId);
  return { message: t("uploaded", { count: outcome.count }) };
}

export async function createFolderAction(
  jobId: string,
  parentId: string | null,
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const { ctx } = await requireJobContext(jobId, "files.create");
  const t = await getTranslations();

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { fieldErrors: translateFieldErrors({ name: parsed.error.issues.map((i) => i.message) }, t) };

  const id = await createFolder(ctx, jobId, parentId, parsed.data);
  if (!id) return { error: t("jobs.files.registerErrors.folder") };

  refresh(jobId);
  return { message: t("jobs.files.folderCreated") };
}

/**
 * Who may rename or delete a folder: `files.update`/`files.delete` on their
 * own, `jobs.moderate` as well for somebody else's — the same rule as a file.
 * The job is the folder's own, read from its row.
 */
async function folderGuard(folderId: string, permission: "files.update" | "files.delete") {
  const base = await requireCompanyContext();
  const folder = await findFolder(base, folderId);
  if (!folder) return null;
  const { ctx } = await requireJobContext(folder.jobId, permission);
  if (!canTouch(ctx.user.id, ctx.permissions, permission, folder.createdById)) return null;
  return { ctx, folder };
}

async function fileGuard(fileId: string, permission: "files.update" | "files.delete") {
  const base = await requireCompanyContext();
  const file = await findFile(base, fileId);
  if (!file) return null;
  const { ctx } = await requireJobContext(file.jobId, permission);
  if (!canTouch(ctx.user.id, ctx.permissions, permission, file.uploadedById)) return null;
  return { ctx, file };
}

export async function renameFolderAction(
  folderId: string,
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await folderGuard(folderId, "files.update");
  if (!guarded) return { error: t("jobs.files.notAllowed") };

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { fieldErrors: translateFieldErrors({ name: parsed.error.issues.map((i) => i.message) }, t) };

  await renameFolder(guarded.ctx, guarded.folder.jobId, folderId, parsed.data);
  refresh(guarded.folder.jobId);
  return { message: t("jobs.files.renamed") };
}

export async function deleteFolderAction(folderId: string): Promise<JobActionState> {
  const t = await getTranslations("jobs.files");
  const guarded = await folderGuard(folderId, "files.delete");
  if (!guarded) return { error: t("notAllowed") };

  await deleteFolder(guarded.ctx, guarded.folder.jobId, folderId);
  refresh(guarded.folder.jobId);
  return { message: t("folderDeleted") };
}

export async function renameFileAction(
  fileId: string,
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const t = await getTranslations();
  const guarded = await fileGuard(fileId, "files.update");
  if (!guarded) return { error: t("jobs.files.notAllowed") };

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { fieldErrors: translateFieldErrors({ name: parsed.error.issues.map((i) => i.message) }, t) };

  await renameFile(guarded.ctx, guarded.file.jobId, fileId, parsed.data);
  refresh(guarded.file.jobId);
  return { message: t("jobs.files.renamed") };
}

async function moveTo(fileId: string, folderId: string | null): Promise<JobActionState> {
  const t = await getTranslations("jobs.files");
  const guarded = await fileGuard(fileId, "files.update");
  if (!guarded) return { error: t("notAllowed") };

  const moved = await moveFile(guarded.ctx, guarded.file.jobId, fileId, folderId);
  if (!moved) return { error: t("registerErrors.folder") };

  refresh(guarded.file.jobId);
  return { message: t("moved") };
}

/** The Move dialog: the folder comes from a select, "" meaning the top level. */
export async function moveFileAction(
  fileId: string,
  _prev: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const target = formData.get("folderId");
  return moveTo(fileId, typeof target === "string" && target !== "" ? target : null);
}

/** Dropping a file on a folder: the same move and the same checks, with no form in between. */
export async function moveFileToAction(fileId: string, folderId: string | null): Promise<JobActionState> {
  return moveTo(fileId, folderId);
}

export async function deleteFileAction(fileId: string): Promise<JobActionState> {
  const t = await getTranslations("jobs.files");
  const guarded = await fileGuard(fileId, "files.delete");
  if (!guarded) return { error: t("notAllowed") };

  await deleteFile(guarded.ctx, guarded.file.jobId, fileId);
  refresh(guarded.file.jobId);
  return { message: t("deleted") };
}
