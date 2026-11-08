"use client";

import { useId } from "react";
import { cn } from "cn";

export type SegmentedOption<T extends string> = { value: T; label: string };

/**
 * Two or three exclusive choices side by side, for a setting that changes how
 * something is *shown* and applies the moment it is picked.
 *
 * Built on real radio inputs rather than buttons with `aria-pressed`: the arrow
 * keys, the single tab stop and the "one of N" announcement all come from the
 * browser, and a form that wanted the value could read it.
 *
 * The inputs are `sr-only`, so each label is `relative` — an `sr-only` box with
 * nothing positioned around it hangs off the document and gives the page a
 * scrollbar nothing explains.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  /** Names the group for assistive technology; nothing sighted needs it. */
  label: string;
  className?: string;
}) {
  const name = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex w-full rounded-full bg-muted p-1", className)}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "relative flex min-h-9 flex-1 cursor-pointer items-center justify-center rounded-full px-3 text-sm font-medium transition-colors",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/60",
            value === option.value
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onValueChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
