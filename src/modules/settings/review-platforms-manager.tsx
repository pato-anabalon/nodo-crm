"use client";

import { startTransition, useActionState, useEffect, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/confirm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ReviewSource } from "@/generated/prisma/enums";
import { useActionToast } from "@/lib/use-action-toast";
import type { SettingsState } from "./actions";

export type ReviewPlatformRow = {
  id: string;
  source: ReviewSource;
  label: string | null;
  readUrl: string | null;
  leaveUrl: string | null;
};

/**
 * Where the company is reviewed, one row per platform with both its links.
 *
 * Reading and leaving are side by side on purpose: they are often the same
 * page with a different anchor (`#ratings`, `#rate`), and the only place a
 * swapped pair is noticed is where the two sit next to each other.
 *
 * Editing is the same call as adding — one row per platform, so saving Google
 * again corrects Google — but the platform itself is fixed while editing:
 * changing it would leave the old row behind and add a second.
 */
export function ReviewPlatformsManager({
  platforms,
  canManage,
  save,
  remove,
}: {
  platforms: ReviewPlatformRow[];
  canManage: boolean;
  /** Server Actions, passed down rather than imported here: importing a
   * `"use server"` module pulls in everything it imports and breaks Jest. */
  save: (prev: SettingsState, formData: FormData) => Promise<SettingsState>;
  remove: (id: string) => Promise<SettingsState>;
}) {
  const t = useTranslations("settings.reviewPlatforms");
  const [editing, setEditing] = useState<ReviewPlatformRow | null>(null);
  // Bumped after every save, so the add form remounts empty.
  const [formKey, setFormKey] = useState(0);
  const [pending, startRemoving] = useTransition();

  const nameOf = (row: Pick<ReviewPlatformRow, "source" | "label">) =>
    row.source === ReviewSource.OTHER && row.label ? row.label : t(`sources.${row.source}`);

  const taken = new Set(platforms.map((row) => row.source));
  const available = Object.values(ReviewSource).filter((source) => !taken.has(source));

  function removeRow(id: string) {
    startRemoving(async () => {
      const result = await remove(id);
      if (result.error) toast.error(result.error);
      else if (result.message) toast.success(result.message);
    });
  }

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {platforms.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{t("empty")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {platforms.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">{nameOf(row)}</p>
                  <LinkLine label={t("read")} url={row.readUrl} notSet={t("notSet")} />
                  <LinkLine label={t("leave")} url={row.leaveUrl} notSet={t("notSet")} />
                </div>

                {canManage ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => setEditing(row)}
                    >
                      <Pencil className="size-4" />
                      {t("edit")}
                    </Button>
                    <ConfirmButton
                      disabled={pending}
                      title={t("removeTitle", { platform: nameOf(row) })}
                      description={t("removeConfirm")}
                      confirmLabel={t("remove")}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t("remove")} ${nameOf(row)}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      onConfirm={() => removeRow(row.id)}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          editing ? (
            <PlatformForm
              key={`edit-${editing.id}`}
              platform={editing}
              sources={[editing.source]}
              save={save}
              onSaved={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          ) : available.length > 0 ? (
            <PlatformForm
              key={`add-${formKey}`}
              platform={null}
              sources={available}
              save={save}
              onSaved={() => setFormKey((key) => key + 1)}
            />
          ) : (
            <p className="text-xs text-muted-foreground">{t("allListed")}</p>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

function LinkLine({ label, url, notSet }: { label: string; url: string | null; notSet: string }) {
  return (
    <p className="flex min-w-0 gap-2 text-xs">
      <span className="w-10 shrink-0 font-medium text-muted-foreground uppercase">{label}</span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-muted-foreground underline underline-offset-2"
        >
          {url}
        </a>
      ) : (
        <span className="text-muted-foreground italic">{notSet}</span>
      )}
    </p>
  );
}

function PlatformForm({
  platform,
  sources,
  save,
  onSaved,
  onCancel,
}: {
  platform: ReviewPlatformRow | null;
  sources: ReviewSource[];
  save: (prev: SettingsState, formData: FormData) => Promise<SettingsState>;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("settings.reviewPlatforms");
  const [state, formAction, saving] = useActionState<SettingsState, FormData>(save, {});
  const [source, setSource] = useState<ReviewSource>(platform?.source ?? sources[0]);

  useActionToast(state);

  useEffect(() => {
    if (state.message) onSaved();
  }, [state, onSaved]);

  /*
   * Dispatched from `onSubmit` rather than through `action`, so a refusal
   * doesn't wipe what was typed: React resets a form with a function `action`
   * whenever it settles, refused or not, and two pasted URLs are a lot to
   * retype because the name was missing. A save remounts the form instead.
   */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const errors = state.fieldErrors ?? {};
  const editing = platform !== null;

  return (
    <form
      action={formAction}
      onSubmit={submit}
      className="space-y-3 rounded-md border bg-panel p-3"
    >
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="platform-source">{t("platform")}</Label>
          {/* Fixed while editing: a different platform is a different row. The
              disabled select doesn't post, so the value travels hidden. */}
          {editing ? <input type="hidden" name="source" value={source} /> : null}
          <NativeSelect
            id="platform-source"
            name={editing ? undefined : "source"}
            className="w-auto"
            disabled={editing}
            value={source}
            onChange={(event) => setSource(event.target.value as ReviewSource)}
            options={sources.map((value) => ({ value, label: t(`sources.${value}`) }))}
          />
        </div>

        {source === ReviewSource.OTHER ? (
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="platform-label">{t("name")}</Label>
            <Input
              id="platform-label"
              name="label"
              defaultValue={platform?.label ?? ""}
              placeholder={t("namePlaceholder")}
              aria-invalid={errors.label ? true : undefined}
            />
            <FieldError messages={errors.label} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="platform-read">{t("readUrl")}</Label>
          <Input
            id="platform-read"
            name="readUrl"
            defaultValue={platform?.readUrl ?? ""}
            placeholder="https://"
            aria-invalid={errors.readUrl ? true : undefined}
          />
          <p className="text-xs text-muted-foreground">{t("readUrlHint")}</p>
          <FieldError messages={errors.readUrl} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="platform-leave">{t("leaveUrl")}</Label>
          <Input
            id="platform-leave"
            name="leaveUrl"
            defaultValue={platform?.leaveUrl ?? ""}
            placeholder="https://"
            aria-invalid={errors.leaveUrl ? true : undefined}
          />
          <p className="text-xs text-muted-foreground">{t("leaveUrlHint")}</p>
          <FieldError messages={errors.leaveUrl} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {editing ? t("save") : t("add")}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}
