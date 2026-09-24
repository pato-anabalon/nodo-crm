"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { LeadActionState } from "./actions";
import { useActionToast } from "@/lib/use-action-toast";

export function LeadNoteForm({
  action,
}: {
  action: (prev: LeadActionState, formData: FormData) => Promise<LeadActionState>;
}) {
  const [state, formAction, pending] = useActionState<LeadActionState, FormData>(action, {});

  useActionToast(state);
  const t = useTranslations("leads");
  const tCommon = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);

  // On a clean save the field is cleared so the next one can be written.
  useEffect(() => {
    if (!pending && !state.error && !state.fieldErrors) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <Textarea name="content" rows={3} placeholder={t("notes.placeholder")} />
      {state.fieldErrors?.content ? (
        <p className="text-sm text-destructive">{state.fieldErrors.content[0]}</p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? tCommon("saving") : t("notes.add")}
      </Button>
    </form>
  );
}
