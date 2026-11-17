"use client"

import * as React from "react"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

/**
 * Keeps a controlled checkbox from being reverted by the form around it.
 *
 * Radix listens for the form's `reset` and answers by setting itself back to
 * the value it had when it mounted — which, for a controlled checkbox, means
 * calling `onCheckedChange` with that old value. React resets the form every
 * time a server action settles, so saving a profile's permissions handed every
 * box its first value back: the changes were stored and the screen showed the
 * ones from before, until the page was left and reopened.
 *
 * A capture listener on the document runs ahead of Radix's own on the form, and
 * marks the reset for the moment it lasts; `onCheckedChange` calls made inside
 * it are the form being reset, not the person clicking, and are dropped. The
 * `checked` prop is untouched, so the box keeps showing what the page says.
 */
function useIgnoreFormReset(
  ref: React.RefObject<HTMLButtonElement | null>,
  onCheckedChange: React.ComponentProps<typeof CheckboxPrimitive.Root>["onCheckedChange"]
) {
  const resetting = React.useRef(false)

  React.useEffect(() => {
    const onReset = (event: Event) => {
      const form = ref.current?.form
      if (!form || event.target !== form) return
      resetting.current = true
      queueMicrotask(() => {
        resetting.current = false
      })
    }
    document.addEventListener("reset", onReset, true)
    return () => document.removeEventListener("reset", onReset, true)
  }, [ref])

  return React.useCallback<NonNullable<typeof onCheckedChange>>(
    (checked) => {
      if (resetting.current) return
      onCheckedChange?.(checked)
    },
    [onCheckedChange]
  )
}

function Checkbox({
  className,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const ref = React.useRef<HTMLButtonElement>(null)
  const handleChange = useIgnoreFormReset(ref, onCheckedChange)

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
        ref={ref}
        onCheckedChange={handleChange}
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
