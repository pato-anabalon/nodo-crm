"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useActionToast } from "@/lib/use-action-toast";
import type { Option } from "@/lib/intl/options";
import type { JobActionState } from "../actions";
import type { FormAction } from "../docs/name-dialogs";
import { PersonAvatar, personName, type Person } from "../avatars";
import { AttachmentField, type Attachment } from "./attachments";
import type { NotifyMode } from "./schemas";

/**
 * Writing a post, new or existing. A draft has two ways out — publish it or
 * keep it — and both post the same form, told apart by `intent`. Once a post
 * is out there is only "save", and nobody is notified again: an edit is a
 * correction, not news.
 */
export function PostForm({
  action,
  jobId,
  prefix,
  categories,
  people,
  defaults,
  existingFiles = [],
  published,
  cancelHref,
}: {
  action: FormAction;
  jobId: string;
  prefix: string;
  categories: Option[];
  /** Everybody on the job but the writer, for "only the people I pick". */
  people: Person[];
  defaults?: { title: string; body: string; categoryId: string | null };
  existingFiles?: Attachment[];
  published: boolean;
  cancelHref: string;
}) {
  const t = useTranslations("jobs.board");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState<JobActionState, FormData>(action, {});
  useActionToast(state);
  const [notify, setNotify] = useState<NotifyMode>("followers");

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="post-category">{t("category")}</Label>
        <NativeSelect
          id="post-category"
          name="categoryId"
          defaultValue={defaults?.categoryId ?? ""}
          options={[{ value: "", label: t("noCategory") }, ...categories]}
          className="sm:max-w-xs"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-title">{t("postTitle")}</Label>
        <Input
          id="post-title"
          name="title"
          defaultValue={defaults?.title ?? ""}
          required
          maxLength={200}
          placeholder={t("titlePlaceholder")}
          className="h-11 text-lg font-semibold"
        />
        {state.fieldErrors?.title ? <p className="text-sm text-destructive">{state.fieldErrors.title[0]}</p> : null}
      </div>

      <div className="space-y-2">
        <Label>{t("body")}</Label>
        <RichTextEditor name="body" variant="full" defaultValue={defaults?.body ?? ""} ariaLabel={t("body")} placeholder={t("bodyPlaceholder")} />
      </div>

      <AttachmentField jobId={jobId} prefix={prefix} existing={existingFiles} />

      {!published ? (
        <fieldset className="space-y-3 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">{t("notifyLegend")}</legend>
          {(["followers", "selected", "nobody"] as const).map((mode) => (
            <label key={mode} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="notify"
                value={mode}
                checked={notify === mode}
                onChange={() => setNotify(mode)}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="font-medium">{t(`notify.${mode}`)}</span>
                <span className="block text-xs text-muted-foreground">{t(`notify.${mode}_hint`)}</span>
              </span>
            </label>
          ))}
          {notify === "selected" ? (
            people.length > 0 ? (
              <ul className="grid gap-2 pl-6 sm:grid-cols-2">
                {people.map((person) => (
                  <li key={person.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="notifyUserId" value={person.id} className="accent-primary" />
                      <PersonAvatar person={person} size="sm" />
                      <span className="truncate">{personName(person)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pl-6 text-xs italic text-muted-foreground">{t("nobodyElse")}</p>
            )
          ) : null}
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {published ? (
          <Button type="submit" name="intent" value="publish" disabled={pending}>
            {pending ? tCommon("saving") : t("saveChanges")}
          </Button>
        ) : (
          <>
            <Button type="submit" name="intent" value="publish" disabled={pending}>
              {t("publish")}
            </Button>
            <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
              {t("saveDraft")}
            </Button>
          </>
        )}
        <Button asChild variant="ghost">
          <Link href={cancelHref}>{tCommon("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
