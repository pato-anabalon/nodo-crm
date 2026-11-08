import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { can } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { requireJobContext } from "@/modules/jobs/access";
import { dayIn } from "@/modules/jobs/timeline";
import { isDay } from "@/modules/jobs/schedule/calendar";
import { createEventAction } from "@/modules/jobs/schedule/actions";
import { EventForm } from "@/modules/jobs/schedule/event-form";
import { assignableMembers } from "@/modules/jobs/todos/service";

export async function generateMetadata() {
  const t = await getTranslations("jobs.schedule");
  return { title: t("newEvent") };
}

export default async function NewEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { ctx, job } = await requireJobContext(id, "schedule.create");
  if (!can(ctx, "schedule.read")) notFound();
  const [t, people] = await Promise.all([getTranslations("jobs.schedule"), assignableMembers(ctx, job.id)]);
  // Clicking a day on the calendar lands here with that day already filled in.
  const day = isDay(query.day) ? query.day : dayIn(new Date(), ctx.company.timezone);
  const back = `/jobs/${job.id}/schedule`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={back} aria-label={t("backToSchedule")}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("newEvent")}</h1>
          <p className="truncate text-sm text-muted-foreground">{job.name}</p>
        </div>
      </div>
      <EventForm
        action={createEventAction.bind(null, job.id)}
        people={people}
        defaults={{
          title: "",
          notes: "",
          allDay: true,
          startsOn: day,
          endsOn: "",
          startTime: "08:00",
          endTime: "09:00",
          isMilestone: false,
          participantIds: [],
        }}
        submitLabel={t("addEvent")}
        cancelHref={back}
      />
    </div>
  );
}
