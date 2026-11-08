"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/lib/use-action-toast";
import type { JobActionState } from "./actions";
import { JOB_COLOURS } from "./colours";

export type JobFormDefaults = {
  name?: string;
  description?: string | null;
  address?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  color?: string | null;
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

      <ColourField defaultValue={defaults.color ?? null} />

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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

/**
 * The job's colour on the Lineup: a row of swatches, posted as one field.
 * "Automatic" is a real choice — the colour derived from the job's id.
 */
function ColourField({ defaultValue }: { defaultValue: string | null }) {
  const t = useTranslations("jobs.fields");
  const [value, setValue] = useState(defaultValue ?? "");
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t("colour")}</legend>
      <input type="hidden" name="color" value={value} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setValue("")}
          aria-pressed={value === ""}
          className="h-7 rounded-full border px-3 text-xs text-muted-foreground aria-pressed:border-foreground aria-pressed:text-foreground"
        >
          {t("colourAuto")}
        </button>
        {JOB_COLOURS.map((colour, index) => (
          <button
            key={colour}
            type="button"
            onClick={() => setValue(colour)}
            aria-pressed={value === colour}
            aria-label={t("colourOption", { n: index + 1 })}
            className="flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background aria-pressed:ring-2 aria-pressed:ring-foreground"
            style={{ backgroundColor: colour }}
          >
            {value === colour ? <Check className="size-4 text-white" /> : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
