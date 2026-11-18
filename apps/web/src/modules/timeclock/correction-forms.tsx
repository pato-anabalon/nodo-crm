"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/lib/use-action-toast";
import { MEAL_BREAK_MAX_MINUTES } from "@nodo/core/timeclock/pay";
import type { TimeclockState } from "./actions";

/**
 * A supervisor's forms on somebody's hours. Every one asks why: the reason is
 * kept with the change, and it is what the person and payroll read later.
 */

type Action = (state: TimeclockState, formData: FormData) => Promise<TimeclockState>;

function FieldError({ state, name }: { state: TimeclockState; name: string }) {
  const message = state.fieldErrors?.[name]?.[0];
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

function Reason({ state, hint }: { state: TimeclockState; hint: string }) {
  const t = useTranslations("timesheets.corrections");
  return (
    <div className="space-y-2">
      <Label htmlFor="reason">{t("reason")}</Label>
      <Textarea id="reason" name="reason" rows={2} maxLength={500} required aria-describedby="reason-hint" />
      <p id="reason-hint" className="text-xs text-muted-foreground">
        {hint}
      </p>
      <FieldError state={state} name="reason" />
    </div>
  );
}

/** Closes the dialog it sits in once the action says it worked. */
function useCloseOnSuccess(state: TimeclockState, close?: () => void) {
  useEffect(() => {
    if (state.message) close?.();
  }, [state, close]);
}

export type ShiftDefaults = { jobId: string; day: string; start: string; end: string };

/**
 * A shift's job, day and times, for entering one by hand or correcting one.
 * `openAllowed` is false for a shift that already ended: it can be moved, not
 * reopened.
 */
export function ShiftForm({
  action,
  jobs,
  defaults,
  openAllowed,
  submitLabel,
  onDone,
}: {
  action: Action;
  jobs: { id: string; name: string }[];
  defaults: ShiftDefaults;
  openAllowed: boolean;
  submitLabel: string;
  onDone?: () => void;
}) {
  const t = useTranslations("timesheets.corrections");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState(action, {});
  useActionToast(state);
  useCloseOnSuccess(state, onDone);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="jobId">{t("job")}</Label>
        <NativeSelect
          id="jobId"
          name="jobId"
          defaultValue={defaults.jobId}
          required
          options={[{ value: "", label: t("chooseJob") }, ...jobs.map((job) => ({ value: job.id, label: job.name }))]}
        />
        <FieldError state={state} name="jobId" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="day">{t("day")}</Label>
          <Input id="day" name="day" type="date" defaultValue={defaults.day} required />
          <FieldError state={state} name="day" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="start">{t("start")}</Label>
          <Input id="start" name="start" type="time" defaultValue={defaults.start} required />
          <FieldError state={state} name="start" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end">{t("end")}</Label>
          <Input id="end" name="end" type="time" defaultValue={defaults.end} required={!openAllowed} />
          <FieldError state={state} name="end" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{openAllowed ? t("endHintOpen") : t("endHint")}</p>
      <Reason state={state} hint={t("reasonHint")} />
      <Button type="submit" disabled={pending}>
        {pending ? tCommon("saving") : submitLabel}
      </Button>
    </form>
  );
}

function FormDialog({
  trigger,
  title,
  description,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}

/** "Add a shift" for a person, in a dialog, starting on `day`. */
export function AddShiftButton({ action, jobs, day, person }: { action: Action; jobs: { id: string; name: string }[]; day: string; person: string }) {
  const t = useTranslations("timesheets.corrections");
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          {t("add")}
        </Button>
      }
      title={t("addTitle", { person })}
      description={t("addDescription")}
    >
      {(close) => (
        <ShiftForm action={action} jobs={jobs} defaults={{ jobId: "", day, start: "", end: "" }} openAllowed submitLabel={t("add")} onDone={close} />
      )}
    </FormDialog>
  );
}

/**
 * The meal break taken on one day. Empty goes back to the company's, which is
 * shown as the placeholder so the person sees what they're overriding.
 */
export function MealButton({
  action,
  day,
  dayLabel,
  current,
  policyMinutes,
}: {
  action: Action;
  day: string;
  dayLabel: string;
  /** What a supervisor set for this day, or null when it follows the company's. */
  current: number | null;
  policyMinutes: number;
}) {
  const t = useTranslations("timesheets.corrections");
  const tCommon = useTranslations("common");
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="sm">
          <UtensilsCrossed className="size-4" />
          {t("meal")}
        </Button>
      }
      title={t("mealTitle", { day: dayLabel })}
      description={t("mealDescription", { minutes: policyMinutes })}
    >
      {(close) => <MealForm action={action} day={day} current={current} policyMinutes={policyMinutes} onDone={close} submitLabel={tCommon("saveChanges")} />}
    </FormDialog>
  );
}

function MealForm({
  action,
  day,
  current,
  policyMinutes,
  onDone,
  submitLabel,
}: {
  action: Action;
  day: string;
  current: number | null;
  policyMinutes: number;
  onDone: () => void;
  submitLabel: string;
}) {
  const t = useTranslations("timesheets.corrections");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState(action, {});
  useActionToast(state);
  useCloseOnSuccess(state, onDone);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="day" value={day} />
      <div className="space-y-2">
        <Label htmlFor="minutes">{t("mealMinutes")}</Label>
        <Input
          id="minutes"
          name="minutes"
          type="number"
          inputMode="numeric"
          min={0}
          max={MEAL_BREAK_MAX_MINUTES}
          step={1}
          defaultValue={current ?? ""}
          placeholder={String(policyMinutes)}
          className="max-w-32"
          aria-describedby="minutes-hint"
        />
        <p id="minutes-hint" className="text-xs text-muted-foreground">
          {t("mealHint")}
        </p>
        <FieldError state={state} name="minutes" />
      </div>
      <Reason state={state} hint={t("reasonHint")} />
      <Button type="submit" disabled={pending}>
        {pending ? tCommon("saving") : submitLabel}
      </Button>
    </form>
  );
}

/**
 * Taking a shift off. Asks why, then asks again: a deleted shift is hours
 * that won't be paid, and its line in the history is all that stays.
 */
export function DeleteShiftForm({ action, shiftLabel }: { action: Action; shiftLabel: string }) {
  const t = useTranslations("timesheets.corrections");
  const [state, formAction, pending] = useActionState(action, {});
  useActionToast(state);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={formAction} className="space-y-4">
      <Reason state={state} hint={t("deleteReasonHint")} />
      <ConfirmButton
        trigger={
          <Button type="button" variant="outline" disabled={pending} className="text-destructive">
            <Trash2 className="size-4" />
            {t("delete")}
          </Button>
        }
        title={t("deleteTitle")}
        description={t("deleteDescription", { shift: shiftLabel })}
        confirmLabel={t("delete")}
        onConfirm={() => form.current?.requestSubmit()}
      />
    </form>
  );
}
