"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  createTaskAction,
  deleteTaskAction,
  setTaskDoneAction,
  type TaskState,
} from "./actions";

export type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  dueLabel: string | null;
  overdue: boolean;
  done: boolean;
  assignee: string | null;
  link: { href: string; label: string } | null;
};

export function TaskManager({
  tasks,
  members,
  currentUserId,
  showDone,
  leadId,
  quoteId,
  compact,
}: {
  tasks: TaskRow[];
  members: Array<{ id: string; name: string }>;
  /** Whoever is adding the task, so it starts out theirs. */
  currentUserId: string;
  showDone: boolean;
  leadId?: string;
  quoteId?: string;
  compact?: boolean;
}) {
  const t = useTranslations("tasks");
  const [state, formAction, saving] = useActionState<TaskState, FormData>(createTaskAction, {});
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);

  function run(fn: () => Promise<TaskState>) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{compact ? t("addHere") : t("add.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
            {leadId ? <input type="hidden" name="leadId" value={leadId} /> : null}
            {quoteId ? <input type="hidden" name="quoteId" value={quoteId} /> : null}

            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="title">{t("form.title")}</Label>
              <Input id="title" name="title" required placeholder={t("form.titlePlaceholder")} />
              {state.fieldErrors?.title ? (
                <p className="text-sm text-destructive">{state.fieldErrors.title[0]}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueAt">{t("form.dueAt")}</Label>
              <Input id="dueAt" name="dueAt" type="date" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigneeId">{t("form.assignee")}</Label>
              {/*
                Defaults to whoever is adding it. Somebody typing a task into
                their own list means it for themselves unless they say
                otherwise, and leaving it on "nobody" is how a task gets added
                and then isn't anywhere the person who added it is looking.
              */}
              <NativeSelect
                id="assigneeId"
                name="assigneeId"
                className="w-auto"
                defaultValue={currentUserId}
                placeholder={t("form.nobody")}
                options={members.map((member) => ({ value: member.id, label: member.name }))}
              />
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? t("form.saving") : t("form.add")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{showDone ? t("doneList") : t("openList")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{showDone ? t("noneDone") : t("none")}</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-wrap items-start gap-3 border-b pb-2 last:border-0 last:pb-0"
              >
                <Checkbox
                  checked={task.done}
                  disabled={pending}
                  onCheckedChange={(value) => run(() => setTaskDoneAction(task.id, value === true))}
                  aria-label={task.title}
                  className="mt-0.5"
                />

                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", task.done && "text-muted-foreground line-through")}>
                    {task.title}
                  </p>
                  {task.notes ? (
                    <p className="text-xs text-muted-foreground">{task.notes}</p>
                  ) : null}
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {task.dueLabel ? (
                      <span className={cn(task.overdue && "font-medium text-[var(--status-viewing)]")}>
                        {task.overdue ? t("overdue", { date: task.dueLabel }) : t("due", { date: task.dueLabel })}
                      </span>
                    ) : null}
                    {task.assignee ? <Badge variant="outline">{task.assignee}</Badge> : null}
                    {task.link ? (
                      <Link href={task.link.href} className="hover:underline">
                        {task.link.label}
                      </Link>
                    ) : null}
                  </p>
                </div>

                <div className="flex gap-1">
                  {task.done ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => setTaskDoneAction(task.id, false))}
                    >
                      <RotateCcw className="size-4" />
                      {t("reopen")}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => setTaskDoneAction(task.id, true))}
                    >
                      <Check className="size-4" />
                      {t("complete")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => deleteTaskAction(task.id))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
