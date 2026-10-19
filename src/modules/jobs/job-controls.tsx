"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmButton } from "@/components/confirm-button";
import { useActionToast } from "@/lib/use-action-toast";
import { JobStatus } from "@/generated/prisma/enums";
import { DateFields, JobForm, type JobFormDefaults } from "./job-form";
import type { JobActionState } from "./actions";

type FormAction = (state: JobActionState, formData: FormData) => Promise<JobActionState>;

/** Name, description and address, in a dialog off the job's header. */
export function EditJobButton({ action, defaults }: { action: FormAction; defaults: JobFormDefaults }) {
  const t = useTranslations("jobs");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          {t("edit")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("edit")}</DialogTitle>
        </DialogHeader>
        <JobForm
          action={action}
          defaults={defaults}
          withDates={false}
          submitLabel={tCommon("saveChanges")}
          pendingLabel={tCommon("saving")}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/** The job's dates, behind `jobs.dates` — moving the plan is its own responsibility. */
export function JobDatesButton({
  action,
  defaults,
  label,
}: {
  action: FormAction;
  defaults: Pick<JobFormDefaults, "startsOn" | "endsOn">;
  label: string;
}) {
  const t = useTranslations("jobs");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: JobActionState, formData: FormData) => {
    const next = await action(prev, formData);
    if (next.message) setOpen(false);
    return next;
  }, {});
  useActionToast(state);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto px-1.5 py-0.5 text-sm font-normal text-muted-foreground">
          <CalendarDays className="size-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dates")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <DateFields defaults={defaults} errors={state.fieldErrors} />
          <Button type="submit" disabled={pending}>
            {pending ? tCommon("saving") : tCommon("save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Changing status posts as soon as it is picked: a select with a Save beside it is two steps for one decision. */
export function JobStatusSelect({ action, status }: { action: FormAction; status: JobStatus }) {
  const t = useTranslations("jobs");
  const [state, formAction, pending] = useActionState(action, {});
  useActionToast(state);

  return (
    <form action={formAction}>
      <NativeSelect
        name="status"
        aria-label={t("fields.status")}
        defaultValue={status}
        disabled={pending}
        className="h-8 w-auto text-sm"
        options={Object.values(JobStatus).map((value) => ({ value, label: t(`status.${value}`) }))}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      />
    </form>
  );
}

export function DeleteJobButton({ name, onDelete }: { name: string; onDelete: () => Promise<void> }) {
  const t = useTranslations("jobs");
  const [pending, startTransition] = useTransition();

  return (
    <ConfirmButton
      trigger={
        <Button variant="ghost" size="sm" className="text-destructive" disabled={pending}>
          <Trash2 className="size-4" />
          {t("delete")}
        </Button>
      }
      title={t("deleteTitle", { name })}
      description={t("deleteBody")}
      confirmLabel={t("delete")}
      onConfirm={() => startTransition(() => onDelete())}
    />
  );
}
