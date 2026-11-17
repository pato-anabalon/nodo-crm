"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useActionToast } from "@/lib/use-action-toast";
import type { JobActionState } from "./actions";

/** A person's trades, read as text, with a dialog of checkboxes to change them. */
export function MemberTrades({
  trades,
  selected,
  canEdit,
  action,
}: {
  trades: { id: string; name: string }[];
  selected: string[];
  canEdit: boolean;
  action: (state: JobActionState, formData: FormData) => Promise<JobActionState>;
}) {
  const t = useTranslations("trades");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: JobActionState, formData: FormData) => {
    const next = await action(prev, formData);
    if (next.message) setOpen(false);
    return next;
  }, {});
  useActionToast(state);

  const names = trades.filter((trade) => selected.includes(trade.id)).map((trade) => trade.name);
  const label = names.length > 0 ? names.join(", ") : t("memberNone");

  if (!canEdit) {
    return <span className={names.length ? "text-sm" : "text-sm italic text-muted-foreground"}>{label}</span>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto max-w-56 justify-start px-1.5 py-0.5 text-left font-normal">
          <span className={names.length ? "truncate" : "truncate italic text-muted-foreground"}>{label}</span>
          <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-label={t("memberEdit")} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("memberEdit")}</DialogTitle>
          {trades.length === 0 ? <DialogDescription>{t("noneConfigured")}</DialogDescription> : null}
        </DialogHeader>
        {trades.length > 0 ? (
          <form action={formAction} className="space-y-4">
            <ul className="space-y-1">
              {trades.map((trade) => (
                <li key={trade.id}>
                  <Label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 font-normal hover:bg-accent">
                    <Checkbox name="tradeId" value={trade.id} defaultChecked={selected.includes(trade.id)} />
                    {trade.name}
                  </Label>
                </li>
              ))}
            </ul>
            <Button type="submit" disabled={pending}>
              {pending ? tCommon("saving") : tCommon("save")}
            </Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
