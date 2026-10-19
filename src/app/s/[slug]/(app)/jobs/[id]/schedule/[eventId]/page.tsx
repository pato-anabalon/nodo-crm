import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Flag, Pencil, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/rich-text";
import { formatDateTime } from "@/lib/format";
import { requireJobContext } from "@/modules/jobs/access";
import { PersonAvatar, personName } from "@/modules/jobs/avatars";
import { CommentThread } from "@/modules/jobs/comments/thread";
import { createEventCommentAction, deleteEventAction } from "@/modules/jobs/schedule/actions";
import { getEvent } from "@/modules/jobs/schedule/service";
import { eventWhen, scheduleFormatters } from "@/modules/jobs/schedule/view";
import { DeleteEventButton } from "@/modules/jobs/schedule/event-controls";

export async function generateMetadata() {
  const t = await getTranslations("jobs.schedule");
  return { title: t("title") };
}

export default async function EventPage({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params;
  const { ctx, job } = await requireJobContext(id, "schedule.read");
  const event = await getEvent(ctx, job.id, eventId);
  if (!event) notFound();
  const t = await getTranslations("jobs.schedule");
  const { formatLocale, timezone } = ctx.company;
  const f = scheduleFormatters(formatLocale, timezone);
  const back = `/jobs/${job.id}/schedule`;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={back} aria-label={t("backToSchedule")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <p className="truncate pt-2 text-sm text-muted-foreground">
          <Link href={`/jobs/${job.id}`} className="hover:underline">
            {job.name}
          </Link>
          {" › "}
          <Link href={back} className="hover:underline">
            {t("title")}
          </Link>
        </p>
      </div>

      <article className="space-y-6 rounded-xl border bg-card p-5 sm:p-8">
        <header className="space-y-2">
          {event.isMilestone ? (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <Flag className="size-3.5" />
              {t("milestone")}
            </p>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight text-balance">{event.title}</h1>
        </header>

        <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-4" />
            {t("when")}
          </dt>
          <dd>
            {eventWhen(event, f)}
            {event.allDay ? <span className="text-muted-foreground"> · {t("allDay")}</span> : null}
          </dd>
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" />
            {t("participants")}
          </dt>
          <dd>
            {event.participants.length > 0 ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {event.participants.map(({ user }) => (
                  <li key={user.id} className="flex items-center gap-2">
                    <PersonAvatar person={user} size="sm" />
                    {personName(user)}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="italic text-muted-foreground">{t("noParticipants")}</span>
            )}
          </dd>
        </dl>

        {event.notes ? <RichText html={event.notes} profile="full" className="text-[0.95rem] leading-relaxed" /> : null}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {t("addedBy", {
              name: event.createdBy ? personName(event.createdBy) : t("someone"),
              when: formatDateTime(event.createdAt, formatLocale, timezone),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            {can(ctx, "schedule.update") ? (
              <Button asChild variant="outline">
                <Link href={`${back}/${event.id}/edit`}>
                  <Pencil className="size-4" />
                  {t("edit")}
                </Link>
              </Button>
            ) : null}
            {can(ctx, "schedule.delete") ? (
              <DeleteEventButton
                title={event.title}
                onDelete={async () => {
                  "use server";
                  return deleteEventAction(eventId);
                }}
              />
            ) : null}
          </div>
        </footer>
      </article>

      <CommentThread
        ctx={ctx}
        jobId={job.id}
        comments={event.comments}
        onCreate={can(ctx, "comments.create") ? createEventCommentAction.bind(null, event.id) : null}
      />
    </div>
  );
}
