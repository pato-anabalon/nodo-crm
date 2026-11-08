import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { formatDate, formatQuoteNumber } from "@/lib/format";
import { listCompanyMembers } from "@/modules/team/service";
import { contactDisplayName } from "@/modules/contacts/identity";
import { taskFiltersFromParams } from "@/modules/tasks/schemas";
import { listTasks } from "@/modules/tasks/service";
import { TaskManager } from "@/modules/tasks/task-manager";

export async function generateMetadata() {
  const t = await getTranslations("tasks");
  return { title: t("title") };
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireCompanyContext();
  const t = await getTranslations("tasks");

  if (!can(ctx, "leads.read")) {
    return <p className="text-sm text-muted-foreground">{t("noAccess")}</p>;
  }

  const filters = taskFiltersFromParams(await searchParams);
  const [tasks, members] = await Promise.all([listTasks(ctx, filters), listCompanyMembers(ctx)]);

  const href = (scope: string, show: string) => `/tasks?scope=${scope}&show=${show}`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["mine", "all"] as const).map((scope) => (
          <Button
            key={scope}
            asChild
            size="sm"
            variant={filters.scope === scope ? "secondary" : "ghost"}
          >
            <Link href={href(scope, filters.show)}>{t(`scope.${scope}`)}</Link>
          </Button>
        ))}

        <span className="mx-1 w-px bg-border" />

        {(["open", "done"] as const).map((show) => (
          <Button
            key={show}
            asChild
            size="sm"
            variant={filters.show === show ? "secondary" : "ghost"}
          >
            <Link href={href(filters.scope, show)}>{t(`show.${show}`)}</Link>
          </Button>
        ))}
      </div>

      <TaskManager
        showDone={filters.show === "done"}
        currentUserId={ctx.user.id}
        members={members.map((member) => ({ id: member.userId, name: member.name }))}
        tasks={tasks.map((task) => ({
          id: task.id,
          title: task.title,
          notes: task.notes,
          dueLabel: task.dueAt
            ? formatDate(task.dueAt, ctx.company.formatLocale, ctx.company.timezone)
            : null,
          overdue: task.overdue,
          done: task.completedAt !== null,
          assignee: task.assignee?.name ?? task.assignee?.email ?? null,
          link: task.lead
            ? { href: `/leads/${task.lead.id}`, label: task.lead.title }
            : task.quote
              ? {
                  href: `/quotes/${task.quote.id}`,
                  label: formatQuoteNumber(ctx.company.quotePrefix, task.quote.number),
                }
              : task.contact
                ? {
                    href: `/contacts/${task.contact.id}`,
                    label: contactDisplayName(task.contact),
                  }
                : null,
        }))}
      />
    </div>
  );
}
