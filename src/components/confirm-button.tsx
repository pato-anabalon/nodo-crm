"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * A button that asks first.
 *
 * For the small destructive actions that sit inside a list — deleting one
 * attachment, one line, one link. The row you mean is not always the row your
 * pointer is on, and the cost of a wrong click is a file that has to be found
 * and uploaded again.
 *
 * **The question names the thing.** "Delete this?" tells you nothing you can
 * check; "Delete Informe Ley 20.575.pdf?" lets you notice it is the wrong one
 * while there is still time.
 */
export function ConfirmButton({
  trigger,
  title,
  description,
  confirmLabel,
  confirmVariant = "destructive",
  onConfirm,
  disabled,
}: {
  trigger: ReactNode;
  title: string;
  /** What exactly is about to happen, with the subject named. */
  description: ReactNode;
  confirmLabel: string;
  /** `destructive` by default — most callers confirm a delete. A non-destructive
   * confirmation (e.g. "you're about to edit something already sent") wants a
   * button that doesn't read as dangerous. */
  confirmVariant?: "destructive" | "default";
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tCommon = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild disabled={disabled}>
        {trigger}
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{tCommon("cancel")}</Button>
          </DialogClose>
          <Button
            variant={confirmVariant}
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
