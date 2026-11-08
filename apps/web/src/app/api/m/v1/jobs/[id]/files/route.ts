import { fileFilterFromParam, matchesFilter } from "@nodo/core/jobs/files";
import { folderTrail } from "@/modules/jobs/folders";
import { allJobFiles, folderContents, jobFolders, registerFiles } from "@/modules/jobs/files-service";
import { jobIn } from "@/modules/mobile/jobs/guard";
import { fileRegisterSchema } from "@/modules/mobile/jobs/schemas";
import { fileView } from "@/modules/mobile/jobs/views";
import { mobileRoute, MobileError, notFound } from "@/modules/mobile/route";

/**
 * Docs & Files, as the web's page reads it: what sits in a folder (`?folder=`,
 * the top without one), with the trail above it — or, with `?kind=images`,
 * `videos` or `documents`, every file of that kind wherever it is filed.
 */
export const GET = mobileRoute({
  permission: "files.read",
  handler: async ({ ctx: base, params, request }) => {
    const { ctx, job } = await jobIn(base, String(params.id), "files.read");
    const query = new URL(request.url).searchParams;
    const folderId = query.get("folder") || null;
    const filter = fileFilterFromParam(query.get("kind") ?? undefined);

    const allFolders = await jobFolders(ctx, job.id);
    if (folderId && !allFolders.some((folder) => folder.id === folderId)) throw notFound();

    const contents = filter
      ? { folders: [], files: (await allJobFiles(ctx, job.id)).filter((file) => matchesFilter(file.contentType, filter)) }
      : await folderContents(ctx, job.id, folderId);

    return {
      trail: folderId ? folderTrail(allFolders, folderId).map(({ id, name }) => ({ id, name })) : [],
      folders: contents.folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        fileCount: folder._count.files,
        folderCount: folder._count.children,
        updatedAt: folder.updatedAt.toISOString(),
      })),
      files: contents.files.map((file) => ({ ...fileView(file), uploadedBy: file.uploadedBy })),
    };
  },
});

/** Files the app has just put in the store, filed into Docs: one timeline line for the batch, as from the web. */
export const POST = mobileRoute({
  permission: "files.create",
  body: fileRegisterSchema,
  handler: async ({ ctx: base, params, body }) => {
    const { ctx, job } = await jobIn(base, String(params.id), "files.create", "files.read");
    const outcome = await registerFiles(ctx, job.id, body.folderId, body.uploads);
    if (!outcome.ok) throw outcome.reason === "folder" ? notFound() : new MobileError(422, "files_refused");
    return { count: outcome.count };
  },
});
