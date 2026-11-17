"use server";

import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { checkDocument, documentPathname, MAX_DOCUMENT_BYTES } from "./constants";

export type DocumentActionState = { error?: string; message?: string };

export async function uploadDocumentAction(
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations("documents");

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: t("errors.empty") };

  const check = checkDocument(file);
  if (!check.ok) {
    return {
      error:
        check.reason === "type"
          ? t("errors.type")
          : check.reason === "size"
            ? t("errors.size", { max: MAX_DOCUMENT_BYTES / (1024 * 1024) })
            : t("errors.empty"),
    };
  }

  // `addRandomSuffix` stops two companies with the same filename from colliding,
  // and stops a URL being guessable from the name.
  const blob = await put(documentPathname(ctx.company.id, file.name), file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });

  const isFirst = (await ctx.db.companyDocument.count()) === 0;

  await ctx.db.companyDocument.create({
    data: {
      companyId: ctx.company.id,
      name: file.name,
      url: blob.url,
      pathname: blob.pathname,
      contentType: file.type,
      size: file.size,
      // The first one becomes the default: with only one, there's nothing to choose.
      isDefault: isFirst,
      uploadedById: ctx.user.id,
    },
  });

  revalidatePath("/settings/documents");
  return { message: t("uploaded") };
}

export async function setDefaultDocumentAction(id: string): Promise<DocumentActionState> {
  const ctx = await requirePermission("settings.update");

  // There can only be one default: the previous one is cleared in the same operation.
  await ctx.db.companyDocument.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  const { count } = await ctx.db.companyDocument.updateMany({ where: { id }, data: { isDefault: true } });

  revalidatePath("/settings/documents");
  if (count === 0) {
    const t = await getTranslations("documents");
    return { error: t("errors.notFound") };
  }
  return {};
}

export async function deleteDocumentAction(id: string): Promise<DocumentActionState> {
  const ctx = await requirePermission("settings.update");
  const t = await getTranslations("documents");

  const doc = await ctx.db.companyDocument.findFirst({ where: { id }, select: { url: true } });
  if (!doc) return { error: t("errors.notFound") };

  // The row first and the file after: if the Blob deletion fails an orphan file
  // is left, which is far less serious than a quote pointing at nothing.
  await ctx.db.companyDocument.deleteMany({ where: { id } });
  await del(doc.url).catch(() => undefined);

  revalidatePath("/settings/documents");
  return { message: t("deleted") };
}
