import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { elapsedLabel } from "@/lib/elapsed-label";
import { jobListFilterFromParams } from "@/modules/jobs/schemas";
import { listJobs, recentJobActivity } from "@/modules/jobs/service";
import { PersonAvatar } from "@/modules/jobs/avatars";
import { JobCards, JobListControls } from "@/modules/jobs/job-list";
import { jobsHref } from "@/modules/jobs/search";
import { activityDescriber } from "@/modules/jobs/activity-feed";
import { activityHref } from "@/modules/jobs/timeline";

export async function generateMetadata() {
  const t = await getTranslations("jobs");
  return { title: t("title") };
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireCompanyContext();
const [t, tElapsed, tCommon] = await Promise.all([
    getTranslations("jobs"),
    getTranslations("common.elapsed"),
    getTranslations("common"),
  ]);

  if (!can(ctx, "jobs.read")) {
    return <p className="text-sm text-muted-foreground">{t("noAccess")}</p>;
  }

  const filter = jobListFilterFromParams(await searchParams);
  const [{ items: jobs, page, pageCount }, recent] = await Promise.all([
    listJobs(ctx, filter),
    recentJobActivity(ctx),
  ]);
  // A page past the end — an old link, a search that now finds fewer — would
  // read as "no finished jobs yet", which isn't true. The last page is.
  if (page > pageCount) redirect(jobsHref(filter.show, filter.q, pageCount));
  const describe = await activityDescriber(ctx, recent);
  const ago = (date: Date) => elapsedLabel(date, tElapsed, ctx.company.formatLocale, ctx.company.timezone);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {can(ctx, "jobs.create") ? (
          <Button asChild>
            <Link href="/jobs/new">
              <Plus className="size-4" />
              {t("new")}
            </Link>
          </Button>
        ) : null}
      </div>

      <JobListControls key={filter.show} show={filter.show} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <JobCards
            show={filter.show}
            jobs={jobs.map((job) => ({
              id: job.id,
              name: job.name,
              description: job.description,
              statusLabel: job.status !== "ACTIVE" ? t(`status.${job.status}`) : null,
              people: job.members.map((m) => m.user),
            }))}
          />

          {pageCount > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{tCommon("pageOf", { page, total: pageCount })}</span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={jobsHref(filter.show, filter.q, page - 1)}>{tCommon("previous")}</Link>
                  </Button>
                ) : null}
                {page < pageCount ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={jobsHref(filter.show, filter.q, page + 1)}>{tCommon("next")}</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <Card className="h-fit">
          <CardContent className="space-y-4">
            <h2 className="text-sm font-semibold">{t("recentActivity")}</h2>
            {recent.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">{t("noRecentActivity")}</p>
            ) : (
              <ol className="space-y-3">
                {recent.map((row) => (
                  <li key={row.id} className="flex gap-2.5 text-sm">
                    {row.actor ? <PersonAvatar person={row.actor} size="sm" /> : <span className="size-6 shrink-0" />}
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs text-muted-foreground">{ago(row.createdAt)}</p>
                      <p className="leading-snug">
                        {activityHref(row.job.id, row.type, row.params) ? (
                          <Link href={activityHref(row.job.id, row.type, row.params)!} className="hover:underline">
                            {describe(row)}
                          </Link>
                        ) : (
                          describe(row)
                        )}
                      </p>
                      <Link href={`/jobs/${row.job.id}`} className="line-clamp-1 text-xs text-muted-foreground hover:underline">
                        {row.job.name}
                      </Link>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

