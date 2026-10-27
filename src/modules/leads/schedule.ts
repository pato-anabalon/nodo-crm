import type { CompanyContext } from "@/lib/auth/session";
import { ActivityType } from "@/generated/prisma/enums";
import { zonedInstant } from "@/lib/zoned-time";
import { createTask } from "@/modules/tasks/service";
import { listCompanyMembers } from "@/modules/team/service";
import type { ScheduleActionValues } from "./schemas";
import { logActivity, visibilityWhere } from "./service";

/**
 * Leaves a follow-up in the lead's log: a `Task` on this lead, due at the day
 * and time given on the company's clocks, plus the log line that says it was
 * scheduled. The reminder is the task's own — `syncDueTasks` raises it once the
 * time passes — so nothing here sends anything.
 *
 * With no assignee it is the author's. Giving it to someone else takes
 * `leads.assign` and a person who is actually on the team.
 */
export async function scheduleLeadAction(
  ctx: CompanyContext,
  leadId: string,
  values: ScheduleActionValues,
): Promise<"ok" | "notFound" | "badAssignee"> {
  const lead = await ctx.db.lead.findFirst({
    where: { id: leadId, ...visibilityWhere(ctx) },
    select: { id: true },
  });
  if (!lead) return "notFound";

  const assigneeId = values.assigneeId ?? ctx.user.id;
  if (assigneeId !== ctx.user.id) {
    const members = ctx.permissions.has("leads.assign") ? await listCompanyMembers(ctx) : [];
    if (!members.some((member) => member.userId === assigneeId)) return "badAssignee";
  }

  await createTask(ctx, {
    title: values.title,
    notes: null,
    dueAt: zonedInstant(values.day, values.time, ctx.company.timezone),
    assigneeId,
    leadId,
    quoteId: null,
    contactId: null,
  });
  await logActivity(ctx, leadId, ActivityType.ACTION_SCHEDULED, values.title);
  return "ok";
}
