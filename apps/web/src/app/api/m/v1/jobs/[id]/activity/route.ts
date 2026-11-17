import { filesByIds } from "@/modules/jobs/files-service";
import { jobActivity } from "@/modules/jobs/service";
import { activityFileIds } from "@/modules/jobs/timeline";
import { jobIn } from "@/modules/mobile/jobs/guard";
import { mobileRoute } from "@/modules/mobile/route";

/**
 * The job's timeline: the latest lines this profile may read, newest first.
 *
 * A line is its type and its parameters, exactly as stored, and the app words
 * it with the same messages the web does — the reason a line stores no
 * sentence. A batch of photos carries the thumbnails it shows; a file deleted
 * since simply drops out.
 */
export const GET = mobileRoute({
  permission: "jobs.read",
  handler: async ({ ctx: base, params }) => {
    const { ctx, job } = await jobIn(base, String(params.id), "jobs.read");
    const rows = await jobActivity(ctx, job.id);
    const files = await filesByIds(ctx, rows.flatMap((row) => activityFileIds(row.params)));
    const thumbnails = new Map(files.filter((file) => file.thumbnailUrl).map((file) => [file.id, file.thumbnailUrl as string]));

    return {
      activity: rows.map((row) => ({
        id: row.id,
        type: row.type,
        params: row.params,
        createdAt: row.createdAt.toISOString(),
        actor: row.actor,
        thumbnails: activityFileIds(row.params)
          .flatMap((fileId) => thumbnails.get(fileId) ?? [])
          .slice(0, 6),
      })),
    };
  },
});
