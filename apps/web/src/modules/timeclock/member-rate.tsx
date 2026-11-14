"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useActionToast } from "@/lib/use-action-toast";
import type { TimeclockState } from "./actions";

/**
 * A person's hourly rate, read as money, with a dialog to change it. The
 * label is formatted on the server — the company's currency and format —
 * because a client component can't be handed the formatter.
 */
export function MemberRate({
  name,
  rate,
  label,
  currency,
  canEdit,
  action,
}: {
  name: string;
  rate: number | null;
  /** `$32.50 / h`, or null with no rate. */
  label: string | null;
  currency: string;
  canEdit: boolean;
  action: (state: TimeclockState, formData: FormData) => Promise<TimeclockState>;
}) {
  const t = useTranslations("team.rate");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: TimeclockState, formData: FormData) => {
    const next = await action(prev, formData);
    if (next.message) setOpen(false);
    return next;
  }, {});
  useActionToast(state);

  const shown = <span className={label ? "text-sm tabular-nums" : "text-sm italic text-muted-foreground"}>{label ?? t("none")}</span>;
  if (!canEdit) return shown;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto justify-start px-1.5 py-0.5 text-left font-normal">
          {shown}
          <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-label={t("edit", { name })} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("edit", { name })}</DialogTitle>
          <DialogDescription>{t("hint", { currency })}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hourlyRate">{t("label", { currency })}</Label>
            <Input
              id="hourlyRate"
              name="hourlyRate"
              inputMode="decimal"
              defaultValue={rate === null ? "" : rate.toFixed(2)}
              placeholder="32.50"
              aria-invalid={Boolean(state.fieldErrors?.hourlyRate)}
            />
            {state.fieldErrors?.hourlyRate ? <p className="text-sm text-destructive">{state.fieldErrors.hourlyRate[0]}</p> : null}
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? tCommon("saving") : tCommon("save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
