"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { del, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import type { CompanyContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/session";
import { LeadAttachmentStatus } from "@/generated/prisma/enums";
import { MAX_LEAD_FILES, MAX_LEAD_FILE_BYTES, checkLeadFile, isLeadFilePathOf, leadFilePathname, type LeadFileCheck } from "./files";
import { recordLeadUpdate } from "./access-log";
import { visibilityWhere } from "./service";

export type LeadFileState = {
  error?: string;
  message?: string;
  file?: { id: string; name: string; url: string; size: number; contentType: string };
};

/** What the browser says about the file it is about to upload — only a claim. */
export type LeadFileInfo = { name: string; size: number; type: string };

export type LeadFileTicket = { error?: string; pathname?: string; token?: string };

const UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;

/** The files this lead already holds, or null when it isn't one this person can open. */
async function fileTarget(ctx: CompanyContext, leadId: string): Promise<{ existingCount: number } | null> {
  const lead = await ctx.db.lead.findFirst({ where: { id: leadId, ...visibilityWhere(ctx) }, select: { id: true } });
  if (!lead) return null;
  const existingCount = await ctx.db.leadAttachment.count({ where: { leadId, uploadedById: { not: null } } });
  return { existingCount };
}

async function checkError(check: LeadFileCheck): Promise<string | undefined> {
  if (check.ok) return undefined;
  const t = await getTranslations("leads.files");
  return check.reason === "type"
    ? t("errors.type")
    : check.reason === "size"
      ? t("errors.size", { max: MAX_LEAD_FILE_BYTES / (1024 * 1024) })
      : check.reason === "too-many"
        ? t("errors.tooMany", { max: MAX_LEAD_FILES })
        : t("errors.empty");
}

/**
 * Step one: permission, target and file are checked, then the browser gets a
 * token bound to a path the server chose. The file itself never passes through
 * a function — a phone photo is past the 4.5 MB a request body may carry.
 */
export async function prepareLeadFileUploadAction(leadId: string, file: LeadFileInfo): Promise<LeadFileTicket> {
  const ctx = await requirePermission("leads.update");
  const t = await getTranslations("leads.files");

  const target = await fileTarget(ctx, leadId);
  if (!target) return { error: t("notFound") };

  const error = await checkError(checkLeadFile(file, target.existingCount));
  if (error) return { error };

  const pathname = leadFilePathname(ctx.company.id, leadId, file.name);
  const token = await generateClientTokenFromReadWriteToken({
    pathname,
    allowedContentTypes: [file.type],
    maximumSizeInBytes: MAX_LEAD_FILE_BYTES,
    addRandomSuffix: true,
    allowOverwrite: false,
    validUntil: Date.now() + UPLOAD_TOKEN_TTL_MS,
  });
  return { pathname, token };
}

/**
 * Step two: the file is in the store and the browser says where. None of that
 * claim is trusted — the path must sit in this lead's folder, the store is asked
 * whether the file is there, and size and type come from its answer.
 */
export async function registerLeadFileAction(
  leadId: string,
  upload: { pathname: string; name: string },
): Promise<LeadFileState> {
  const ctx = await requirePermission("leads.update");
  const t = await getTranslations("leads.files");

  const target = await fileTarget(ctx, leadId);
  if (!target) return { error: t("notFound") };
  if (!isLeadFilePathOf(ctx.company.id, leadId, upload.pathname)) return { error: t("notFound") };

  const stored = await head(upload.pathname).catch(() => null);
  if (!stored) return { error: t("notFound") };

  // One file, one row: a second row on the same blob would leave the first
  // pointing at nothing the moment either was deleted.
  if ((await ctx.db.leadAttachment.count({ where: { pathname: stored.pathname } })) > 0) {
    return { error: t("notFound") };
  }

  const name = upload.name.trim().slice(0, 255) || stored.pathname.split("/").pop()!;
  const error = await checkError(
    checkLeadFile({ name, size: stored.size, type: stored.contentType }, target.existingCount),
  );
  if (error) {
    // Uploaded but refused: nothing will ever point at it, so it goes.
    await del(stored.url).catch(() => undefined);
    return { error };
  }

  const row = await ctx.db.leadAttachment.create({
    data: {
      companyId: ctx.company.id,
      leadId,
      name,
      contentType: stored.contentType,
      size: stored.size,
      // Our own copy is the only one there is: nothing was fetched from a form.
      sourceUrl: stored.url,
      url: stored.url,
      pathname: stored.pathname,
      status: LeadAttachmentStatus.STORED,
      position: target.existingCount,
      uploadedById: ctx.user.id,
    },
  });
  await recordLeadUpdate(ctx, leadId, "files");

  revalidatePath(`/leads/${leadId}`);
  return {
    message: t("uploaded"),
    file: { id: row.id, name: row.name, url: stored.url, size: stored.size, contentType: stored.contentType },
  };
}

export async function deleteLeadFileAction(leadId: string, fileId: string): Promise<LeadFileState> {
  const ctx = await requirePermission("leads.update");
  const t = await getTranslations("leads.files");

  const target = await fileTarget(ctx, leadId);
  if (!target) return { error: t("notFound") };

  // Only files the team attached: the ones a web form sent are the customer's
  // record of what they submitted, and `uploadedById` is what tells them apart.
  const row = await ctx.db.leadAttachment.findFirst({
    where: { id: fileId, leadId, uploadedById: { not: null } },
    select: { url: true },
  });
  if (!row) return { error: t("notFound") };

  await ctx.db.leadAttachment.deleteMany({ where: { id: fileId, leadId } });
  if (row.url) await del(row.url).catch(() => undefined);
  await recordLeadUpdate(ctx, leadId, "files");

  revalidatePath(`/leads/${leadId}`);
  return { message: t("deleted") };
}
