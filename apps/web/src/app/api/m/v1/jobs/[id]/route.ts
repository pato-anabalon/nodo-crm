import { formatQuoteNumber } from "@/lib/format";
import { getJob } from "@/modules/jobs/service";
import { dayKey } from "@/modules/jobs/schemas";
import { found, jobIn } from "@/modules/mobile/jobs/guard";
import { permissionList } from "@/modules/mobile/jobs/views";
import { mobileRoute } from "@/modules/mobile/route";

/**
 * One job, and what this person may do on it. `permissions` is the context the
 * guard settled on, so a finished job comes back with its writes taken off and
 * the app offers nothing the server would refuse.
 */
export const GET = mobileRoute({
  permission: "jobs.read",
  handler: async ({ ctx: base, params }) => {
    const { ctx, job: access } = await jobIn(base, String(params.id), "jobs.read");
    const job = found(await getJob(ctx, access.id));
    return {
      job: {
        id: job.id,
        name: job.name,
        description: job.description,
        address: job.address,
        status: job.status,
        closed: access.closed,
        closedAt: job.closedAt?.toISOString() ?? null,
        closedBy: job.closedBy,
        startsOn: dayKey(job.startsOn),
        endsOn: dayKey(job.endsOn),
        color: job.color,
        quote: job.quote ? { id: job.quote.id, reference: formatQuoteNumber(ctx.company.quotePrefix, job.quote.number) } : null,
        members: job.members.map((member) => ({ ...member.user, following: member.following })),
      },
      permissions: permissionList(ctx.permissions),
    };
  },
});
