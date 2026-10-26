import { prisma } from "@/lib/db/prisma";
import { JobStatus, MembershipStatus, NotificationKind } from "@/generated/prisma/enums";
import type { Language } from "@/generated/prisma/enums";
import { notify } from "@/modules/notifications/inbox";
import { sendJobEmails } from "./emails";
import { addDays } from "./schedule/calendar";
import { dayIn } from "./timeline";

type CompanyRow = { id: string; name: string; slug: string; timezone: string; defaultLanguage: Language };

/** How far back a missed date is still worth saying out loud. */
const LOOKBACK_DAYS = 1;
/** One night's work is bounded; what is left over is the next night's. */
const BATCH = 300;

/**
 * The to-dos on a job that reached their date, told to whoever they were
 * assigned to — once.
 *
 * **Once per to-do and date**, not once a day: a to-do a fortnight late nagging
 * every evening is how people stop opening the email. The key carries the due
 * day, so moving the date earns a fresh notice. **Only today and yesterday**:
 * the first night after this ships, every old unfinished to-do would otherwise
 * be announced at once, by nobody's decision.
 *
 * The date is the job's own day, in the company's zone — a to-do due "Friday"
 * is due on the company's Friday whatever time the sweep runs. Finished jobs
 * are silent: nothing there can be done any more.
 */
export async function sweepDueJobTodos(company: CompanyRow, now: Date): Promise<number> {
  const today = dayIn(now, company.timezone);
  const from = addDays(today, -LOOKBACK_DAYS);

  const todos = await prisma.jobTodo.findMany({
    where: {
      companyId: company.id,
      completedAt: null,
      dueOn: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${today}T00:00:00Z`) },
      job: { status: { in: [JobStatus.ACTIVE, JobStatus.ON_HOLD] } },
      assignees: { some: {} },
    },
    select: {
      id: true,
      title: true,
      jobId: true,
      dueOn: true,
      job: { select: { name: true } },
      assignees: { select: { userId: true } },
    },
    orderBy: { dueOn: "asc" },
    take: BATCH,
  });

  let raised = 0;
  for (const todo of todos) {
    const dueDay = todo.dueOn ? todo.dueOn.toISOString().slice(0, 10) : today;
    const href = `/jobs/${todo.jobId}/todos/${todo.id}`;
    const params = { title: todo.title, job: todo.job.name };

    // Still on the job, still allowed to open it: a notice is a link, and a
    // link that answers 404 is noise.
    const readers = await readersOf(company.id, todo.jobId, todo.assignees.map((a) => a.userId));

    const fresh: string[] = [];
    for (const userId of readers) {
      const created = await notify({
        companyId: company.id,
        userId,
        kind: NotificationKind.JOB_TODO_DUE,
        params,
        href,
        dedupeKey: `jobTodoDue:${todo.id}:${dueDay}`,
      });
      if (created) fresh.push(userId);
    }
    if (fresh.length === 0) continue;

    raised += fresh.length;
    await sendJobEmails(company, { userIds: fresh, template: "todoDue", params, path: href });
  }
  return raised;
}

/** Of these people, those on the job, active in the company, whose profile reads both the job and its to-dos. */
async function readersOf(companyId: string, jobId: string, userIds: string[]): Promise<string[]> {
  const members = await prisma.jobMember.findMany({
    where: { jobId, userId: { in: userIds } },
    select: { userId: true },
  });
  if (members.length === 0) return [];
  const memberships = await prisma.membership.findMany({
    where: {
      companyId,
      status: MembershipStatus.ACTIVE,
      userId: { in: members.map((m) => m.userId) },
      AND: [
        { role: { permissions: { some: { permission: { key: "jobs.read" } } } } },
        { role: { permissions: { some: { permission: { key: "todos.read" } } } } },
      ],
    },
    select: { userId: true },
  });
  return memberships.map((m) => m.userId);
}
