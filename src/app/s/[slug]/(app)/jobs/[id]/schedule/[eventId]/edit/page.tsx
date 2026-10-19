import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { wallClock } from "@/lib/zoned-time";
import { Button } from "@/components/ui/button";
import { requireJobContext } from "@/modules/jobs/access";
import { dayKey } from "@/modules/jobs/schemas";
import { updateEventAction } from "@/modules/jobs/schedule/actions";
import { getEvent } from "@/modules/jobs/schedule/service";
import { EventForm } from "@/modules/jobs/schedule/event-form";
import { assignableMembers } from "@/modules/jobs/todos/service";

export async function generateMetadata() {
  const t = await getTranslations("jobs.schedule");
  return { title: t("editEvent") };
}

export default async function EditEventPage({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params;
  const { ctx, job } = await requireJobContext(id, "schedule.update");
  if (!can(ctx, "schedule.read")) notFound();
  const [event, people] = await Promise.all([getEvent(ctx, job.id, eventId), assignableMembers(ctx, job.id)]);
  if (!event) notFound();
  const t = await getTranslations("jobs.schedule");
  const back = `/jobs/${job.id}/schedule/${event.id}`;
  const tz = ctx.company.timezone;
  const startsOn = dayKey(event.startsOn)!;
  const endsOn = dayKey(event.endsOn)!;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={back} aria-label={t("backToEvent")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("editEvent")}</h1>
          <p className="truncate text-sm text-muted-foreground">{job.name}</p>
        </div>
      </div>
      <EventForm
        action={updateEventAction.bind(null, event.id)}
        people={people}
        defaults={{
          title: event.title,
          notes: event.notes ?? "",
          allDay: event.allDay,
          startsOn,
          endsOn: endsOn === startsOn ? "" : endsOn,
          startTime: event.startsAt ? wallClock(event.startsAt, tz).time : "08:00",
          endTime: event.endsAt ? wallClock(event.endsAt, tz).time : "09:00",
          isMilestone: event.isMilestone,
          participantIds: event.participants.map(({ user }) => user.id),
        }}
        submitLabel={t("saveEvent")}
        cancelHref={back}
      />
    </div>
  );
}
