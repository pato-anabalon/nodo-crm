"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Archive, RotateCcw, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { LeadActionState } from "./actions";

export type Member = { userId: string; name: string };

/**
 * Lead actions. Each one lands in the activity log with its author and time,
 * which is why the discard dialog asks for a reason before running.
 */
export function LeadActionsBar({
  ownerId,
  discarded,
  members,
  canAssign,
  canDiscard,
  onAssign,
  onDiscard,
  onRestore,
}: {
  ownerId: string | null;
  discarded: boolean;
  members: Member[];
  canAssign: boolean;
  canDiscard: boolean;
  onAssign: (ownerId: string | null) => Promise<LeadActionState>;
  onDiscard: (formData: FormData) => Promise<LeadActionState>;
  onRestore: () => Promise<LeadActionState>;
}) {
  const t = useTranslations("leads");
  const tCommon = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  function run(fn: () => Promise<LeadActionState>, onDone?: () => void) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else {
        // It used to only speak when something went wrong, so assigning a lead
        // succeeded in silence — indistinguishable from nothing happening.
        if (result.message) toast.success(result.message);
        onDone?.();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canAssign && !discarded ? (
        <div className="flex items-center gap-2">
          <UserCheck className="size-4 text-muted-foreground" />
          <NativeSelect
            aria-label={t("actions.assignTo")}
            defaultValue={ownerId ?? ""}
            disabled={pending}
            onChange={(event) => run(() => onAssign(event.target.value || null))}
            className="w-auto"
            placeholder={tCommon("unassigned")}
            options={members.map((member) => ({ value: member.userId, label: member.name }))}
          />
        </div>
      ) : null}

      {canDiscard && discarded ? (
        <Button variant="outline" disabled={pending} onClick={() => run(onRestore)}>
          <RotateCcw className="size-4" />
          {t("actions.restore")}
        </Button>
      ) : null}

      {canDiscard && !discarded ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={pending}>
              <Archive className="size-4" />
              {t("actions.discard")}
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("actions.discardTitle")}</DialogTitle>
              <DialogDescription>{t("actions.discardBody")}</DialogDescription>
            </DialogHeader>

            <form
              action={(formData: FormData) =>
                run(
                  () => onDiscard(formData),
                  () => setDialogOpen(false),
                )
              }
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="reason">{t("actions.discardReason")}</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  rows={3}
                  maxLength={500}
                  placeholder={t("actions.discardReasonPlaceholder")}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" variant="destructive" disabled={pending}>
                  {t("actions.confirmDiscard")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
