"use client"

import * as React from "react"
import { cn } from "cn"
import type { Option, OptionGroup } from "@/lib/intl/options"

/**
 * A real `<select>`, not the Radix one next door.
 *
 * Every form in this app is an ordinary form posted to a server action, so the
 * control has to carry its own value in the FormData without JavaScript in
 * between — which the Radix listbox does not. The whole app hand-rolled this
 * element ten times over with the same class string copy-pasted; this is that
 * string, in one place.
 */
/**
 * Re-applies the selection after the form is reset.
 *
 * A `<select>` keeps its selection as DOM state, not as an attribute React
 * re-renders — so when a form is reset, the browser falls back to the first
 * option. React sees nothing changed and re-renders nothing, and the control
 * is left showing a value nobody chose.
 *
 * React resets the form on its own every time a server action settles, which
 * is where this bites: saving a quote in AUD left the picker reading AED, the
 * alphabetically first currency, over a record that had been stored correctly.
 *
 * Deferred by a microtask because the `reset` event fires *before* the controls
 * are cleared; restoring inside the handler would be undone a moment later.
 */
function useSelectionSurvivesReset(
  ref: React.RefObject<HTMLSelectElement | null>,
  wanted: string | number | readonly string[] | undefined,
) {
  React.useEffect(() => {
    const element = ref.current
    const form = element?.form
    if (!element || !form || wanted === undefined) return

    const restore = () => {
      queueMicrotask(() => {
        element.value = String(wanted)
      })
    }

    form.addEventListener("reset", restore)
    return () => form.removeEventListener("reset", restore)
  }, [ref, wanted])
}

function NativeSelect({
  className,
  options,
  groups,
  placeholder,
  children,
  ref: externalRef,
  ...props
}: Omit<React.ComponentProps<"select">, "children"> & {
  /** A flat list. */
  options?: Option[]
  /** Or a grouped one, for lists too long to scan in one go. */
  groups?: OptionGroup[]
  /** An empty leading entry, for "no lead", "pick one"… */
  placeholder?: string
  children?: React.ReactNode
}) {
  const ref = React.useRef<HTMLSelectElement>(null)

  // Whichever the caller is using to say what should be selected.
  useSelectionSurvivesReset(ref, props.value ?? props.defaultValue)

  return (
    <select
      data-slot="native-select"
      ref={(element) => {
        ref.current = element
        if (typeof externalRef === "function") externalRef(element)
        else if (externalRef) externalRef.current = element
      }}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-field px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      {groups?.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </optgroup>
      ))}
      {children}
    </select>
  )
}

export { NativeSelect }
