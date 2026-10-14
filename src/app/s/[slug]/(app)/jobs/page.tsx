import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { elapsedLabel } from "@/lib/elapsed-label";
import { jobListFilterFromParams } from "@/modules/jobs/schemas";
import { listJobs, recentJobActivity } from "@/modules/jobs/service";
import { AvatarStack, PersonAvatar } from "@/modules/jobs/avatars";
import { activityDescriber } from "@/modules/jobs/activity-feed";

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
  const [t, tElapsed] = await Promise.all([getTranslations("jobs"), getTranslations("common.elapsed")]);

  if (!can(ctx, "jobs.read")) {
    return <p className="text-sm text-muted-foreground">{t("noAccess")}</p>;
  }

  const filter = jobListFilterFromParams(await searchParams);
  const [jobs, recent] = await Promise.all([listJobs(ctx, filter), recentJobActivity(ctx)]);
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

      <div className="flex flex-wrap gap-2">
        {(["active", "done"] as const).map((show) => (
          <Button key={show} asChild size="sm" variant={filter === show ? "secondary" : "ghost"}>
            <Link href={show === "active" ? "/jobs" : "/jobs?show=done"}>{t(`show.${show}`)}</Link>
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {jobs.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">{filter === "done" ? t("emptyDone") : t("empty")}</p>
        ) : (
          <ul className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
                >
                  <span className="line-clamp-2 font-semibold leading-snug">{job.name}</span>
                  {job.description ? (
                    <span className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
                      {job.description}
                    </span>
                  ) : null}
                  <span className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <AvatarStack people={job.members.map((m) => m.user)} />
                    {job.status !== "ACTIVE" ? (
                      <span className="text-xs text-muted-foreground">{t(`status.${job.status}`)}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

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
                      <p className="leading-snug">{describe(row)}</p>
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
