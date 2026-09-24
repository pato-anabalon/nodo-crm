"use client"

import * as React from "react"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    /*
     * The wrapper exists to be positioned, and nothing else.
     *
     * What the browser posts is not this button: given a `name` inside a form,
     * Radix renders a real `<input type="checkbox">` beside it, carrying
     * `position: absolute` and `transform: translateX(-100%)` as inline styles
     * — its own comment says this "pulls it back to sit on top of the button".
     * That only holds if something around them is positioned. With nothing, the
     * input answers to the document instead and lands at the foot of the page,
     * which is a scrollbar on the whole shell with no visible cause.
     *
     * Same failure as `sr-only` on the file input, from the same cause, and the
     * fix belongs here rather than on each screen: a checkbox added tomorrow
     * would otherwise arrive carrying the bug.
     */
    <span className="relative inline-flex shrink-0">
      <CheckboxPrimitive.Root
        data-slot="checkbox"
        className={cn(
          "peer size-4 shrink-0 rounded-[4px] border border-input bg-field shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary",
          className
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          className="grid place-content-center text-current transition-none"
        >
          <CheckIcon className="size-3.5" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </span>
  )
}

export { Checkbox }
