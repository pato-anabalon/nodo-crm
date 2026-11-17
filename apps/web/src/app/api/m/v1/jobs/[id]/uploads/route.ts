import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { JOB_UPLOAD_PERMISSIONS, jobFilePathname, jobUploadPrefix, uploadAllowance } from "@nodo/core/jobs/files";
import { can, ForbiddenError } from "@/lib/auth/session";
import { jobIn } from "@/modules/mobile/jobs/guard";
import { uploadTokenSchema } from "@/modules/mobile/jobs/schemas";
import { uploadRefusal } from "@/modules/mobile/jobs/uploads";
import { mobileRoute, MobileError } from "@/modules/mobile/route";

/** Long enough for a site video over a weak signal; each part of a multipart upload carries the token. */
const TOKEN_MINUTES = 60;

/**
 * The bearer twin of `/api/jobs/<id>/upload`: a token to put **one** file
 * straight into the store, so the bytes never pass through a function (4.5 MB
 * is less than one phone photo). The app uploads with `put()` from
 * `@vercel/blob/client`, or a plain PUT, and then posts what came back with
 * the to-do, comment, message or Docs filing it belongs to — which is where it
 * is checked all over again (`verifyUploads`) before a row is written.
 *
 * The path is built here from the name, under this job's prefix: the app never
 * names a path, so it has none to forge. The store holds the token to it, to
 * the type the extension maps to and to that type's cap.
 */
export const POST = mobileRoute({
  body: uploadTokenSchema,
  handler: async ({ ctx: base, params, body }) => {
    const permission = JOB_UPLOAD_PERMISSIONS.find((key) => can(base, key));
    if (!permission) throw new ForbiddenError(JOB_UPLOAD_PERMISSIONS[0]);
    const { ctx, job } = await jobIn(base, String(params.id), permission);

    const refusal = uploadRefusal(body);
    if (refusal) throw new MobileError(422, refusal);

    const prefix = jobUploadPrefix(ctx.company.id, job.id);
    const pathname = jobFilePathname(prefix, body.name, body.thumbnail ? "thumbnail" : undefined);
    const allowance = uploadAllowance(pathname, prefix);
    if (!allowance) throw new MobileError(422, "file_type");

    const validUntil = Date.now() + TOKEN_MINUTES * 60_000;
    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname,
      ...allowance,
      addRandomSuffix: true,
      validUntil,
    });

    return {
      pathname,
      clientToken,
      contentType: allowance.allowedContentTypes[0],
      maximumSizeInBytes: allowance.maximumSizeInBytes,
      validUntil: new Date(validUntil).toISOString(),
    };
  },
});
