"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/lib/use-action-toast";
import type { LeadActionState } from "./actions";

/**
 * Leaves a follow-up in the log: what to do, and the day and time it is for.
 * The assignee starts on whoever is writing it — someone noting "call back in
 * two days" means it for themselves unless they say otherwise.
 */
export function LeadScheduleForm({
  action,
  members,
  currentUserId,
}: {
  action: (prev: LeadActionState, formData: FormData) => Promise<LeadActionState>;
  /** Empty when the person can't assign: the follow-up is then their own. */
  members: Array<{ userId: string; name: string }>;
  currentUserId: string;
}) {
  const t = useTranslations("leads.schedule");
  const [state, formAction, pending] = useActionState<LeadActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useActionToast(state);

  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="scheduleTitle">{t("what")}</Label>
        <Input id="scheduleTitle" name="title" placeholder={t("whatPlaceholder")} />
        {errors.title?.map((message) => (
          <p key={message} className="text-xs text-destructive">
            {message}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="scheduleDay">{t("day")}</Label>
          <Input id="scheduleDay" name="day" type="date" required />
          {errors.day?.map((message) => (
            <p key={message} className="text-xs text-destructive">
              {message}
            </p>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="scheduleTime">{t("time")}</Label>
          <Input id="scheduleTime" name="time" type="time" defaultValue="09:00" required />
          {errors.time?.map((message) => (
            <p key={message} className="text-xs text-destructive">
              {message}
            </p>
          ))}
        </div>

        {members.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="scheduleAssignee">{t("assignee")}</Label>
            <NativeSelect id="scheduleAssignee" name="assigneeId" defaultValue={currentUserId}>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">{t("hint")}</p>

      <Button type="submit" size="sm" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}

export type ScheduledActionRow = {
  id: string;
  title: string;
  /** Already formatted in the company's locale and timezone. */
  dueLabel: string;
  overdue: boolean;
  assignee: string | null;
};

type TaskResult = { error?: string; message?: string };

/**
 * The follow-ups still waiting on this lead. Ticking one off or removing it
 * goes through the very task actions `/tasks` uses, passed in as props like
 * every other server action in a client component.
 */
export function LeadScheduledActions({
  rows,
  completeAction,
  deleteAction,
}: {
  rows: ScheduledActionRow[];
  completeAction: (id: string, done: boolean) => Promise<TaskResult>;
  deleteAction: (id: string) => Promise<TaskResult>;
}) {
  const t = useTranslations("leads.schedule");
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) return null;

  function run(work: () => Promise<TaskResult>) {
    startTransition(async () => {
      const result = await work();
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{t("pending")}</h3>
      <ul className="divide-y rounded-lg border bg-background">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.title}</p>
              <p className={row.overdue ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {row.overdue ? t("overdue", { date: row.dueLabel }) : t("due", { date: row.dueLabel })}
                {row.assignee ? ` · ${row.assignee}` : ""}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              aria-label={t("done", { title: row.title })}
              onClick={() => run(() => completeAction(row.id, true))}
            >
              <Check className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              aria-label={t("remove", { title: row.title })}
              onClick={() => run(() => deleteAction(row.id))}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
