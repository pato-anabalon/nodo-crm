"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useActionToast } from "@/lib/use-action-toast";
import type { JobActionState } from "./actions";

type FormAction = (state: JobActionState, formData: FormData) => Promise<JobActionState>;

/**
 * A line of the scope and the form that changes it, in the same place: the
 * line is read where it sits, so it is edited where it sits. The body is
 * rendered on the server and handed in (`view`), because rich text is
 * sanitised there and nowhere else.
 */
export function ScopeLine({
  title,
  body,
  view,
  edited,
  copy,
  update,
  remove,
}: {
  title: string;
  /** The stored HTML, for the editor to start from. */
  body: string | null;
  view: ReactNode;
  /** "Edited by Ana · 3 Nov", or null for a line as the quote had it. */
  edited: string | null;
  copy: ReactNode;
  /** Absent without `scope.update`: the line only reads. */
  update?: FormAction;
  remove?: () => Promise<JobActionState>;
}) {
  const t = useTranslations("jobs.scope");
  const [editing, setEditing] = useState(false);
  const [removed, setRemoved] = useState<JobActionState>({});
  useActionToast(removed);

  if (editing && update) {
    return (
      <li className="rounded-xl border bg-card p-4">
        <ScopeForm
          action={update}
          defaults={{ title, body }}
          submitLabel={t("save")}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 font-semibold">{title}</h2>
        <div className="flex shrink-0 items-center">
          {copy}
          {update ? (
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              <span className="sr-only">{t("edit")}</span>
            </Button>
          ) : null}
          {remove ? (
            <ConfirmButton
              trigger={
                <Button size="icon" variant="ghost">
                  <Trash2 className="size-4" />
                  <span className="sr-only">{t("delete")}</span>
                </Button>
              }
              title={t("deleteTitle", { title })}
              description={t("deleteBody")}
              confirmLabel={t("delete")}
              onConfirm={async () => setRemoved(await remove())}
            />
          ) : null}
        </div>
      </div>
      {view}
      {edited ? <p className="mt-3 text-xs text-muted-foreground">{edited}</p> : null}
    </li>
  );
}

/** "Add a line", opening the same form under the list. */
export function AddScopeLine({ action }: { action: FormAction }) {
  const t = useTranslations("jobs.scope");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t("add")}
      </Button>
    );
  }
  return (
    <div className="rounded-xl border bg-card p-4">
      <ScopeForm action={action} defaults={{ title: "", body: null }} submitLabel={t("add")} onDone={() => setOpen(false)} />
    </div>
  );
}

function ScopeForm({
  action,
  defaults,
  submitLabel,
  onDone,
}: {
  action: FormAction;
  defaults: { title: string; body: string | null };
  submitLabel: string;
  onDone: () => void;
}) {
  const t = useTranslations("jobs.scope");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState(action, {});
  useActionToast(state);

  useEffect(() => {
    if (state.message) onDone();
  }, [state, onDone]);

  const titleError = state.fieldErrors?.title?.[0];
  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="scope-title">{t("lineTitle")}</Label>
        <Input
          id="scope-title"
          name="title"
          defaultValue={defaults.title}
          maxLength={500}
          required
          autoFocus
          aria-invalid={titleError ? true : undefined}
        />
        {titleError ? <p className="text-sm text-destructive">{titleError}</p> : null}
      </div>
      <div className="space-y-2">
        <Label>{t("lineBody")}</Label>
        <RichTextEditor name="body" defaultValue={defaults.body} ariaLabel={t("lineBody")} minHeight="sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? tCommon("saving") : submitLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          {tCommon("cancel")}
        </Button>
      </div>
    </form>
  );
}
