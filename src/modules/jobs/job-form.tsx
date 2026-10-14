"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/lib/use-action-toast";
import type { JobActionState } from "./actions";

export type JobFormDefaults = {
  name?: string;
  description?: string | null;
  address?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
};

/**
 * Name, description and address — and, when creating, the dates. Editing
 * leaves the dates out: they sit behind `jobs.dates`, a different permission,
 * and have their own form on the job.
 */
export function JobForm({
  action,
  defaults = {},
  withDates,
  submitLabel,
  pendingLabel,
  onDone,
}: {
  action: (state: JobActionState, formData: FormData) => Promise<JobActionState>;
  defaults?: JobFormDefaults;
  withDates: boolean;
  submitLabel: string;
  pendingLabel: string;
  onDone?: () => void;
}) {
  const t = useTranslations("jobs.fields");
  const [state, formAction, pending] = useActionState(async (prev: JobActionState, formData: FormData) => {
    const next = await action(prev, formData);
    if (next.message) onDone?.();
    return next;
  }, {});
  useActionToast(state);

  const error = (field: string) =>
    state.fieldErrors?.[field] ? <p className="text-sm text-destructive">{state.fieldErrors[field][0]}</p> : null;

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="job-name">{t("name")}</Label>
        <Input id="job-name" name="name" required defaultValue={defaults.name ?? ""} maxLength={200} />
        {error("name")}
      </div>

      <div className="space-y-2">
        <Label htmlFor="job-address">{t("address")}</Label>
        <Input id="job-address" name="address" defaultValue={defaults.address ?? ""} maxLength={300} />
        {error("address")}
      </div>

      <div className="space-y-2">
        <Label htmlFor="job-description">{t("description")}</Label>
        <Textarea id="job-description" name="description" rows={3} defaultValue={defaults.description ?? ""} maxLength={2000} />
        {error("description")}
      </div>

      {withDates ? <DateFields defaults={defaults} errors={state.fieldErrors} /> : null}

      <Button type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}

export function DateFields({
  defaults,
  errors,
}: {
  defaults: Pick<JobFormDefaults, "startsOn" | "endsOn">;
  errors?: Record<string, string[]>;
}) {
  const t = useTranslations("jobs.fields");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="job-starts">{t("startsOn")}</Label>
        <Input id="job-starts" name="startsOn" type="date" defaultValue={defaults.startsOn ?? ""} />
        {errors?.startsOn ? <p className="text-sm text-destructive">{errors.startsOn[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="job-ends">{t("endsOn")}</Label>
        <Input id="job-ends" name="endsOn" type="date" defaultValue={defaults.endsOn ?? ""} />
        {errors?.endsOn ? <p className="text-sm text-destructive">{errors.endsOn[0]}</p> : null}
      </div>
    </div>
  );
}
