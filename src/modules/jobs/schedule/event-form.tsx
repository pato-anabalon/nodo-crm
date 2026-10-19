"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useActionToast } from "@/lib/use-action-toast";
import type { JobActionState } from "../actions";
import type { FormAction } from "../docs/name-dialogs";
import type { Person } from "../avatars";
import { PeoplePicker } from "../people-picker";

export type EventDefaults = {
  title: string;
  notes: string;
  allDay: boolean;
  startsOn: string;
  endsOn: string;
  startTime: string;
  endTime: string;
  isMilestone: boolean;
  participantIds: string[];
};

/**
 * Adding or editing an event. Days and times are typed on the company's own
 * clocks — the server knows its timezone and turns them into instants. "All
 * day" hides the times rather than disabling them, so a day-long delivery is
 * two fields, not four with two greyed out.
 */
export function EventForm({
  action,
  people,
  defaults,
  submitLabel,
  cancelHref,
}: {
  action: FormAction;
  people: Person[];
  defaults: EventDefaults;
  submitLabel: string;
  cancelHref: string;
}) {
  const t = useTranslations("jobs.schedule");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<JobActionState, FormData>(action, {});
  useActionToast(state);
  const [allDay, setAllDay] = useState(defaults.allDay);
  const error = (field: string) =>
    state.fieldErrors?.[field] ? <p className="text-sm text-destructive">{state.fieldErrors[field][0]}</p> : null;

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="event-title">{t("eventTitle")}</Label>
        <Input
          id="event-title"
          name="title"
          defaultValue={defaults.title}
          required
          maxLength={300}
          placeholder={t("eventTitlePlaceholder")}
          className="h-11 text-lg font-semibold"
        />
        {error("title")}
      </div>

      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">{t("when")}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="allDay"
            checked={allDay}
            onChange={(event) => setAllDay(event.target.checked)}
            className="accent-primary"
          />
          {t("allDay")}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="event-starts">{t("startsOn")}</Label>
            <div className="flex gap-2">
              <Input id="event-starts" type="date" name="startsOn" required defaultValue={defaults.startsOn} />
              {!allDay ? (
                <Input type="time" name="startTime" aria-label={t("startTime")} defaultValue={defaults.startTime} required className="w-32" />
              ) : null}
            </div>
            {error("startsOn")}
            {error("startTime")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-ends">{t("endsOn")}</Label>
            <div className="flex gap-2">
              <Input id="event-ends" type="date" name="endsOn" defaultValue={defaults.endsOn} />
              {!allDay ? (
                <Input type="time" name="endTime" aria-label={t("endTime")} defaultValue={defaults.endTime} required className="w-32" />
              ) : null}
            </div>
            {error("endsOn")}
            {error("endTime")}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("endHint")}</p>
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="isMilestone" defaultChecked={defaults.isMilestone} className="mt-0.5 accent-primary" />
        <span>
          <span className="font-medium">{t("milestone")}</span>
          <span className="block text-xs text-muted-foreground">{t("milestoneHint")}</span>
        </span>
      </label>

      <PeoplePicker
        name="participantId"
        label={t("participants")}
        emptyLabel={t("noParticipants")}
        people={people}
        defaultIds={defaults.participantIds}
      />

      <div className="space-y-2">
        <Label>{t("notes")}</Label>
        <RichTextEditor name="notes" variant="full" minHeight="sm" defaultValue={defaults.notes} ariaLabel={t("notes")} placeholder={t("notesPlaceholder")} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("saving") : submitLabel}
        </Button>
        <Button asChild variant="ghost">
          <Link href={cancelHref}>{tCommon("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
