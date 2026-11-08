"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/lib/use-action-toast";
import type { Option } from "@/lib/intl/options";
import type { JobActionState } from "../actions";

export type FormAction = (state: JobActionState, formData: FormData) => Promise<JobActionState>;

/**
 * A dialog with one field and a save, closed by the action succeeding. Used to
 * name a new folder and to rename a folder or a file — three dialogs that would
 * otherwise drift apart.
 */
export function NameDialog({
  title,
  action,
  defaultValue = "",
  open,
  onOpenChange,
  trigger,
}: {
  title: string;
  action: FormAction;
  defaultValue?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactNode;
}) {
  const t = useTranslations("jobs.files");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState(async (prev: JobActionState, formData: FormData) => {
    const next = await action(prev, formData);
    if (next.message) onOpenChange(false);
    return next;
  }, {});
  useActionToast(state);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="job-file-name">{t("name")}</Label>
            <Input id="job-file-name" name="name" defaultValue={defaultValue} required maxLength={255} autoFocus />
            {state.fieldErrors?.name ? <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p> : null}
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? tCommon("saving") : tCommon("save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewFolderButton({ action }: { action: FormAction }) {
  const t = useTranslations("jobs.files");
  const [open, setOpen] = useState(false);
  return (
    <NameDialog
      title={t("newFolder")}
      action={action}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="outline">
          <FolderPlus className="size-4" />
          {t("newFolder")}
        </Button>
      }
    />
  );
}

/** Where a file goes: every folder by its whole path, and the top level first. */
export function MoveDialog({
  action,
  current,
  folders,
  open,
  onOpenChange,
}: {
  action: FormAction;
  current: string | null;
  folders: Option[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("jobs.files");
  const [state, formAction, pending] = useActionState(async (prev: JobActionState, formData: FormData) => {
    const next = await action(prev, formData);
    if (next.message) onOpenChange(false);
    return next;
  }, {});
  useActionToast(state);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("move")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="job-file-folder">{t("moveTo")}</Label>
            <NativeSelect
              id="job-file-folder"
              name="folderId"
              defaultValue={current ?? ""}
              options={[{ value: "", label: t("topLevel") }, ...folders]}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? t("moving") : t("move")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
