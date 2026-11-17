"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ListPlus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmButton } from "@/components/confirm-button";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useActionToast } from "@/lib/use-action-toast";
import type { JobActionState } from "../actions";
import type { FormAction } from "../docs/name-dialogs";

/** A list's name and what it is for, in a dialog closed by the save succeeding. */
function TodoListDialog({
  title,
  action,
  defaults,
  trigger,
}: {
  title: string;
  action: FormAction;
  defaults?: { name: string; description: string };
  trigger: ReactNode;
}) {
  const t = useTranslations("jobs.todos");
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="todo-list-name">{t("listName")}</Label>
            <Input
              id="todo-list-name"
              name="name"
              defaultValue={defaults?.name ?? ""}
              required
              maxLength={200}
              placeholder={t("listNamePlaceholder")}
              autoFocus
            />
            {state.fieldErrors?.name ? <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p> : null}
          </div>
          <div className="space-y-2">
            <Label>{t("listDescription")}</Label>
            <RichTextEditor
              name="description"
              variant="full"
              minHeight="sm"
              defaultValue={defaults?.description ?? ""}
              ariaLabel={t("listDescription")}
              placeholder={t("listDescriptionPlaceholder")}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? tCommon("saving") : tCommon("save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewTodoListButton({ action }: { action: FormAction }) {
  const t = useTranslations("jobs.todos");
  return (
    <TodoListDialog
      title={t("newList")}
      action={action}
      trigger={
        <Button>
          <ListPlus className="size-4" />
          {t("newList")}
        </Button>
      }
    />
  );
}

export function EditTodoListButton({ action, defaults }: { action: FormAction; defaults: { name: string; description: string } }) {
  const t = useTranslations("jobs.todos");
  return (
    <TodoListDialog
      title={t("editList")}
      action={action}
      defaults={defaults}
      trigger={
        <Button variant="outline">
          <Pencil className="size-4" />
          {t("editList")}
        </Button>
      }
    />
  );
}

/** Deleting asks first, and says what goes with it. */
function DeleteButton({
  label,
  title,
  description,
  onDelete,
}: {
  label: string;
  title: string;
  description: string;
  onDelete: () => Promise<JobActionState>;
}) {
  const [pending, start] = useTransition();
  return (
    <ConfirmButton
      trigger={
        <Button type="button" variant="outline" disabled={pending}>
          <Trash2 className="size-4" />
          {label}
        </Button>
      }
      title={title}
      description={description}
      confirmLabel={label}
      onConfirm={() =>
        start(async () => {
          const result = await onDelete();
          if (result?.error) toast.error(result.error);
        })
      }
    />
  );
}

export function DeleteTodoListButton({ name, onDelete }: { name: string; onDelete: () => Promise<JobActionState> }) {
  const t = useTranslations("jobs.todos");
  return (
    <DeleteButton label={t("delete")} title={t("deleteListTitle", { name })} description={t("deleteListBody")} onDelete={onDelete} />
  );
}

export function DeleteTodoButton({ title, onDelete }: { title: string; onDelete: () => Promise<JobActionState> }) {
  const t = useTranslations("jobs.todos");
  return (
    <DeleteButton label={t("delete")} title={t("deleteTodoTitle", { title })} description={t("deleteTodoBody")} onDelete={onDelete} />
  );
}
