"use client";

import { UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/ui/native-select";
import { QUOTE_FORM_ID } from "./constants";

/**
 * Who the quote belongs to, in the header beside the actions, the way a lead's
 * owner is.
 *
 * Unlike a lead's it doesn't act on its own: it joins the quote's edit form
 * through the `form` attribute, so choosing somebody else takes effect with the
 * form's own **Save changes** — the same press that saves everything else on
 * the quote, and the same one a person would reach for.
 */
export function QuoteOwnerSelect({
  ownerId,
  owners,
}: {
  ownerId: string | null;
  owners: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("quotes.form");

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <UserCheck aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <NativeSelect
        form={QUOTE_FORM_ID}
        name="ownerId"
        aria-label={t("owner")}
        title={t("ownerHint")}
        defaultValue={ownerId ?? ""}
        placeholder={t("ownerNone")}
        options={owners.map((owner) => ({ value: owner.id, label: owner.name }))}
        className="w-full sm:w-auto"
      />
    </div>
  );
}
