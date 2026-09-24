"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Announces what happened to an action, in the one place the app announces it.
 *
 * Every screen here posts a form to a server action and gets back the same
 * shape. Most of them raised a snackbar; a handful only wrote the result inline,
 * so saving a quote and saving a price list told you in two different ways. The
 * effect was copied into a dozen components, which is how the odd one out gets
 * written in the first place.
 *
 * **Field errors are not this.** "The title is too short" belongs beside the
 * title, where it can be read while the field is being fixed; a snackbar that
 * fades takes the message away mid-correction. What this announces is what
 * became of the action — saved, or refused — which is a single fact about the
 * whole form.
 */
export function useActionToast(state: { message?: string; error?: string }) {
  useEffect(() => {
    if (state.message) toast.success(state.message);
    if (state.error) toast.error(state.error);
  }, [state]);
}
