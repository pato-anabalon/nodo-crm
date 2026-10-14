import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, FolderOpen, MapPin, MessagesSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can, requireCompanyContext } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { formatDate, formatQuoteNumber } from "@/lib/format";
import { roleDisplayName } from "@/lib/auth/role-name";
import { getJob, jobActivity, memberCandidates, tradesByUser } from "@/modules/jobs/service";
import {
  addJobMembersAction,
  deleteJobAction,
  removeJobMemberAction,
  setFollowingAction,
  setJobDatesAction,
  setJobStatusAction,
  updateJobAction,
} from "@/modules/jobs/actions";
import { dayKey } from "@/modules/jobs/schemas";
import { activityFileIds, activityHref, dateRange, groupByDay } from "@/modules/jobs/timeline";
import { filesByIds, filesSummary } from "@/modules/jobs/files-service";
import { latestPosts } from "@/modules/jobs/board/service";
import { postCategoryName } from "@/modules/jobs/categories";
import { personName } from "@/modules/jobs/avatars";
import { activityDescriber } from "@/modules/jobs/activity-feed";
import { PersonAvatar } from "@/modules/jobs/avatars";
import { JobPeople, type JobPerson } from "@/modules/jobs/job-people";
import { DeleteJobButton, EditJobButton, JobDatesButton, JobStatusSelect } from "@/modules/jobs/job-controls";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCompanyContext();
  const job = can(ctx, "jobs.read") ? await getJob(ctx, id) : null;
  return { title: job?.name ?? "" };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCompanyContext();
  if (!can(ctx, "jobs.read")) notFound();

  const job = await getJob(ctx, id);
  if (!job) notFound();

  const canMembers = can(ctx, "jobs.members");
  const canFiles = can(ctx, "files.read");
  const canBoard = can(ctx, "messages.read");
  const [t, tRoles, activity, candidates, trades, files, board] = await Promise.all([
    getTranslations("jobs"),
    getTranslations("roles"),
    jobActivity(ctx, job.id),
    canMembers ? memberCandidates(ctx, job.id) : Promise.resolve([]),
    tradesByUser(ctx, job.members.map((m) => m.userId)),
    canFiles ? filesSummary(ctx, job.id) : Promise.resolve(null),
    canBoard ? latestPosts(ctx, job.id) : Promise.resolve(null),
  ]);
  const [describe, mentionedFiles] = await Promise.all([
    activityDescriber(ctx, activity),
    // The photos a batch line shows; one deleted since simply drops out.
    filesByIds(ctx, activity.flatMap((row) => activityFileIds(row.params))),
  ]);
  const thumbnails = new Map(
    mentionedFiles.filter((file) => file.thumbnailUrl).map((file) => [file.id, file.thumbnailUrl as string]),
  );
  const photosOf = (row: { params: unknown }) =>
    activityFileIds(row.params)
      .flatMap((fileId) => thumbnails.get(fileId) ?? [])
      .slice(0, 6);

  const hrefOf = (row: (typeof activity)[number]) => activityHref(job.id, row.type, row.params);

  const { formatLocale, timezone } = ctx.company;
  const formatDay = (day: string) => formatDate(new Date(`${day}T00:00:00Z`), formatLocale, "UTC");
  const tDates = (key: string, values?: Record<string, string | number>) => t(key, values);
  const datesLabel = dateRange(dayKey(job.startsOn), dayKey(job.endsOn), tDates, formatDay);
  const time = new Intl.DateTimeFormat(formatLocale, { timeStyle: "short", timeZone: timezone });
  const heading = new Intl.DateTimeFormat(formatLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const members: JobPerson[] = job.members.map((m) => {
    const extra = trades.get(m.userId);
    return {
      ...m.user,
      roleName: extra ? roleDisplayName(extra.role, tRoles) : "",
      trades: extra?.trades ?? [],
    };
  });
  const me = job.members.find((m) => m.userId === ctx.user.id);

  const reference = job.quote ? formatQuoteNumber(ctx.company.quotePrefix, job.quote.number) : null;
  const jobId = job.id;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href="/jobs" aria-label={t("backToJobs")}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{job.name}</h1>
            {job.description ? (
              <p className="whitespace-pre-line text-sm text-muted-foreground">{job.description}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {can(ctx, "jobs.update") ? (
                <JobStatusSelect action={setJobStatusAction.bind(null, jobId)} status={job.status} />
              ) : (
                <span>{t(`status.${job.status}`)}</span>
              )}
              {can(ctx, "jobs.dates") ? (
                <JobDatesButton
                  action={setJobDatesAction.bind(null, jobId)}
                  defaults={{ startsOn: dayKey(job.startsOn), endsOn: dayKey(job.endsOn) }}
                  label={datesLabel}
                />
              ) : (
                <span>{datesLabel}</span>
              )}
              {job.address ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" />
                  {job.address}
                </span>
              ) : null}
              {/* The way back to the quote is only for whoever can open quotes;
                  the figures on it stay behind `quotes.read.amounts` as ever. */}
              {job.quote && reference && can(ctx, "quotes.read") ? (
                <Link href={`/quotes/${job.quote.id}`} className="inline-flex items-center gap-1 hover:underline">
                  <FileText className="size-4" />
                  {t("fromQuote", { reference })}
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {can(ctx, "jobs.update") ? (
            <EditJobButton
              action={updateJobAction.bind(null, jobId)}
              defaults={{ name: job.name, description: job.description, address: job.address }}
            />
          ) : null}
          {can(ctx, "jobs.delete") ? (
            <DeleteJobButton
              name={job.name}
              onDelete={async () => {
                "use server";
                await deleteJobAction(jobId);
              }}
            />
          ) : null}
        </div>
      </div>

      <JobPeople
        members={members}
        candidates={candidates.map((c) => ({ ...c, roleName: roleDisplayName(c.role, tRoles) }))}
        currentUserId={ctx.user.id}
        following={me ? me.following : null}
        canManage={canMembers}
        onAdd={addJobMembersAction.bind(null, jobId)}
        onRemove={async (userId) => {
          "use server";
          return removeJobMemberAction(jobId, userId);
        }}
        onFollow={async (following) => {
          "use server";
          return setFollowingAction(jobId, following);
        }}
      />

      {board || files ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {board ? (
            <Link
              href={`/jobs/${jobId}/messages`}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <span className="flex items-center gap-2 font-semibold">
                <MessagesSquare className="size-5 text-muted-foreground" />
                {t("board.title")}
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {t("board.count", { count: board.count })}
                </span>
              </span>
              {board.posts.length > 0 ? (
                <ul className="space-y-2">
                  {board.posts.map((post) => (
                    <li key={post.id} className="min-w-0 text-sm">
                      <span className="block truncate font-medium">
                        {post.category ? `${post.category.emoji} ` : null}
                        {post.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {post.author ? personName(post.author) : t("board.someone")}
                        {post.category ? ` · ${postCategoryName(post.category, (key) => t(`board.${key}`))}` : null}
                        {post._count.comments > 0 ? ` · ${t("board.commentCount", { count: post._count.comments })}` : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-sm italic text-muted-foreground">{t("board.cardEmpty")}</span>
              )}
            </Link>
          ) : null}
          {files ? (
            <Link
              href={`/jobs/${jobId}/files`}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <span className="flex items-center gap-2 font-semibold">
                <FolderOpen className="size-5 text-muted-foreground" />
                {t("files.title")}
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {t("files.count", { count: files.count })}
                </span>
              </span>
              {files.images.length > 0 ? (
                <span className="grid grid-cols-3 gap-1.5">
                  {files.images.map((image) => (
                    // eslint-disable-next-line @next/next/no-img-element -- a small copy made at upload.
                    <img
                      key={image.id}
                      src={image.thumbnailUrl ?? undefined}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full rounded object-cover"
                    />
                  ))}
                </span>
              ) : (
                <span className="text-sm italic text-muted-foreground">
                  {files.count === 0 ? t("files.cardEmpty") : t("files.cardNoPhotos")}
                </span>
              )}
            </Link>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("timeline.title")}</h2>
        {activity.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">{t("timeline.empty")}</p>
        ) : (
          <ol className="space-y-6">
            {groupByDay(activity, timezone).map((day) => (
              <li key={day.day} className="space-y-3">
                {day.quietBefore > 0 ? (
                  <p className="text-xs text-muted-foreground">{t("timeline.quiet", { days: day.quietBefore })}</p>
                ) : null}
                <div className="flex items-center gap-3">
                  <span className="rounded bg-muted px-2 py-1 text-xs font-semibold uppercase tracking-wide">
                    {heading.format(new Date(`${day.day}T12:00:00Z`))}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <ul className="space-y-3 border-l pl-4 sm:ml-2">
                  {day.entries.map((row) => (
                    <li key={row.id} className="flex items-start gap-3 text-sm">
                      <span className="w-16 shrink-0 pt-1 text-xs text-muted-foreground">{time.format(row.createdAt)}</span>
                      {row.actor ? <PersonAvatar person={row.actor} size="sm" /> : null}
                      <div className="min-w-0 space-y-2 pt-0.5">
                        <p className="font-medium">
                          {hrefOf(row) ? (
                            <Link href={hrefOf(row)!} className="hover:underline">
                              {describe(row)}
                            </Link>
                          ) : (
                            describe(row)
                          )}
                        </p>
                        {photosOf(row).length > 0 ? (
                          <Link href={`/jobs/${jobId}/files`} className="flex flex-wrap gap-1.5">
                            {photosOf(row).map((src) => (
                              // eslint-disable-next-line @next/next/no-img-element -- a small copy made at upload.
                              <img key={src} src={src} alt="" loading="lazy" className="size-16 rounded object-cover" />
                            ))}
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
