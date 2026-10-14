import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCompanyContext } from "@/lib/auth/session";
import { jobAccess } from "@/modules/jobs/access";
import { jobUploadPrefix, uploadAllowance } from "@/modules/jobs/files";

/**
 * Hands the browser a token to upload one file straight to Blob.
 *
 * The file itself never passes through here: a Vercel function's body stops at
 * 4.5 MB, and a plan or a site video is many times that. What this route
 * decides is whether to let it happen at all — the same three questions as
 * every job page (`jobAccess`), a path under this job's own prefix, and the
 * type and size the rules table allows for that extension.
 *
 * The upload is registered afterwards by `registerJobFilesAction`, not by
 * Blob calling back here: the callback can't reach localhost, and the action
 * checks the path all over again before a row is written.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await getCompanyContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const job = await jobAccess(ctx, id, "files.create");
  if (!job) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const prefix = jobUploadPrefix(ctx.company.id, job.id);
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const allowance = uploadAllowance(pathname, prefix);
        if (!allowance) throw new Error("refused");
        return { ...allowance, addRandomSuffix: true };
      },
    });
    return NextResponse.json(result);
  } catch {
    // Mute on purpose, like the ingest API: which check failed is of no use
    // to anybody but someone probing.
    return NextResponse.json({ error: "refused" }, { status: 400 });
  }
}
