"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Choose a file, read which one, send it — in one row.
 *
 * **The native input is hidden rather than styled.** Browsers draw their own
 * "Choose File" chrome inside it, which reads as a text field with a word in it
 * and not as something to press, and no stylesheet can reach it. A button that
 * clicks the input is a real button, and the chosen name goes beside it where a
 * person can check it before sending.
 *
 * **Send sits beside the file it acts on.** In a form laid out as a row of
 * fields the submit button drifts to the far edge, which is the width of the
 * card away from the thing it is about to upload.
 *
 * One component for the three upload sites — quote attachments, the company
 * logo, the terms PDF — so a fourth can't be built the wrong way. The same
 * reason `RichText` is one component.
 */
export function FilePicker({
  id,
  name,
  accept,
  chooseLabel,
  noneChosenLabel,
  submitLabel,
  pendingLabel,
  pending = false,
  className,
}: {
  id: string;
  /** Field name in the submitted `FormData`. */
  name: string;
  accept: string;
  chooseLabel: string;
  /** Stands where the file name will go, so the row doesn't change height. */
  noneChosenLabel: string;
  submitLabel: string;
  pendingLabel: string;
  pending?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  /** Shown beside the button, because a hidden input can't say what it holds. */
  const [chosen, setChosen] = useState<string | null>(null);

  /*
   * The chosen name clears when the form does.
   *
   * React resets the form once the action settles, so the native input empties
   * itself; this keeps the label beside it in step. Done on the form's own
   * `reset` event rather than in an effect watching the action's result —
   * setting state from an effect is what starts a cascade, and the event says
   * the same thing at the same moment. Deferred by a microtask because `reset`
   * fires before the controls are actually cleared.
   */
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const clear = () => queueMicrotask(() => setChosen(null));
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

  return (
    /*
     * `relative` is load-bearing, not decoration.
     *
     * `sr-only` is `position: absolute` with no offsets, so it hangs off the
     * nearest positioned ancestor. With none, that is the document itself: the
     * 1×1 input lands at the very bottom of the page and gives it a few hundred
     * pixels of empty scroll that nothing on screen explains. This box is that
     * ancestor.
     */
    <div className={cn("relative flex flex-wrap items-center gap-2", className)}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        required
        className="sr-only"
        onChange={(event) => setChosen(event.target.files?.[0]?.name ?? null)}
      />

      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Paperclip className="size-4" />
        {chooseLabel}
      </Button>

      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {chosen ?? noneChosenLabel}
      </span>

      <Button type="submit" size="sm" disabled={pending || !chosen}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </div>
  );
}
