import { listJobs } from "@/modules/jobs/service";
import { dayKey, jobListFilterFromParams } from "@/modules/jobs/schemas";
import { mobileRoute } from "@/modules/mobile/route";

/**
 * The jobs this person can see: `?show=active` (the default) or `?show=done`.
 *
 * The same `listJobs` as the web, with the same split: in progress comes whole
 * and is searched on the phone, done is paged and searched with `?q=` here.
 */
export const GET = mobileRoute({
  permission: "jobs.read",
  handler: async ({ ctx, request }) => {
    const filter = jobListFilterFromParams(Object.fromEntries(new URL(request.url).searchParams));
    const { items, page, pageCount } = await listJobs(ctx, filter);
    return {
      page,
      pageCount,
      jobs: items.map((job) => ({
        id: job.id,
        name: job.name,
        description: job.description,
        status: job.status,
        startsOn: dayKey(job.startsOn),
        endsOn: dayKey(job.endsOn),
        members: job.members.map((member) => member.user),
      })),
    };
  },
});
