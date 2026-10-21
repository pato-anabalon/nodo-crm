"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useActionToast } from "@/lib/use-action-toast";
import type { Option } from "@/lib/intl/options";
import type { JobActionState } from "../actions";
import type { FormAction } from "../docs/name-dialogs";
import type { Person } from "../avatars";
import { PeoplePicker } from "../people-picker";
import { AttachmentField, type Attachment } from "../board/attachments";

export type TodoDefaults = {
  title: string;
  notes: string;
  startsOn: string | null;
  dueOn: string | null;
  assigneeIds: string[];
  listId: string;
};

/** The fields a to-do is made of — the same when adding one and when editing it. */
function TodoFields({
  idPrefix,
  people,
  defaults,
  errors,
  jobId,
  prefix,
  existingFiles,
  lists,
  autoFocus,
}: {
  idPrefix: string;
  people: Person[];
  defaults?: Partial<TodoDefaults>;
  errors?: Record<string, string[]>;
  jobId: string;
  prefix: string;
  existingFiles?: Attachment[];
  /** Offered only when editing: moving a to-do to another list. */
  lists?: Option[];
  autoFocus?: boolean;
}) {
  const t = useTranslations("jobs.todos");
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-title`}>{t("todoTitle")}</Label>
        <Input
          id={`${idPrefix}-title`}
          name="title"
          defaultValue={defaults?.title ?? ""}
          required
          maxLength={500}
          placeholder={t("todoPlaceholder")}
          autoFocus={autoFocus}
        />
        {errors?.title ? <p className="text-sm text-destructive">{errors.title[0]}</p> : null}
      </div>

      {lists && lists.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-list`}>{t("list")}</Label>
          <NativeSelect id={`${idPrefix}-list`} name="listId" defaultValue={defaults?.listId} options={lists} className="sm:max-w-xs" />
        </div>
      ) : null}

      <PeoplePicker
        name="assigneeId"
        label={t("assignees")}
        emptyLabel={t("unassigned")}
        people={people}
        defaultIds={defaults?.assigneeIds}
      />

      <div className="grid grid-cols-1 gap-3 sm:max-w-md sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-starts`}>{t("startsOn")}</Label>
          <Input id={`${idPrefix}-starts`} type="date" name="startsOn" defaultValue={defaults?.startsOn ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-due`}>{t("dueOn")}</Label>
          <Input id={`${idPrefix}-due`} type="date" name="dueOn" defaultValue={defaults?.dueOn ?? ""} />
          {errors?.dueOn ? <p className="text-sm text-destructive">{errors.dueOn[0]}</p> : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("notes")}</Label>
        <RichTextEditor
          name="notes"
          variant="full"
          minHeight="sm"
          defaultValue={defaults?.notes ?? ""}
          ariaLabel={t("notes")}
          placeholder={t("notesPlaceholder")}
        />
      </div>

      <AttachmentField jobId={jobId} prefix={prefix} existing={existingFiles} />
    </>
  );
}

/**
 * "Add a to-do" at the foot of a list. After a save the form starts over and
 * stays open — a list is usually written several items at a time — by
 * changing its key from inside the action, as the comment box does.
 */
export function NewTodoForm({
  action,
  jobId,
  prefix,
  people,
}: {
  action: FormAction;
  jobId: string;
  prefix: string;
  people: Person[];
}) {
  const t = useTranslations("jobs.todos");
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t("addTodo")}
      </Button>
    );
  }
  return (
    <NewTodoRound
      key={round}
      action={action}
      jobId={jobId}
      prefix={prefix}
      people={people}
      onDone={() => setRound((n) => n + 1)}
      onCancel={() => setOpen(false)}
    />
  );
}

function NewTodoRound({
  action,
  jobId,
  prefix,
  people,
  onDone,
  onCancel,
}: {
  action: FormAction;
  jobId: string;
  prefix: string;
  people: Person[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("jobs.todos");
  const tCommon = useTranslations("common");
  // The snackbar is raised here: a successful round is replaced before an
  // effect in it would get to run.
  const [state, formAction, pending] = useActionState(async (prev: JobActionState, formData: FormData) => {
    const next = await action(prev, formData);
    if (next.message) {
      toast.success(next.message);
      onDone();
    }
    return next.message ? {} : next;
  }, {});
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <TodoFields idPrefix="new-todo" people={people} errors={state.fieldErrors} jobId={jobId} prefix={prefix} autoFocus />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("saving") : t("addThisTodo")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {tCommon("cancel")}
        </Button>
      </div>
    </form>
  );
}

/** Editing a to-do, on its own page. */
export function TodoEditForm({
  action,
  jobId,
  prefix,
  people,
  lists,
  defaults,
  existingFiles,
  cancelHref,
}: {
  action: FormAction;
  jobId: string;
  prefix: string;
  people: Person[];
  lists: Option[];
  defaults: TodoDefaults;
  existingFiles: Attachment[];
  cancelHref: string;
}) {
  const t = useTranslations("jobs.todos");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<JobActionState, FormData>(action, {});
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-5">
      <TodoFields
        idPrefix="edit-todo"
        people={people}
        defaults={defaults}
        errors={state.fieldErrors}
        jobId={jobId}
        prefix={prefix}
        existingFiles={existingFiles}
        lists={lists}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? tCommon("saving") : t("saveTodo")}
        </Button>
        <Button asChild variant="ghost">
          <Link href={cancelHref}>{tCommon("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
