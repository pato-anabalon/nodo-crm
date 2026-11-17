"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { sanitizeNumericInput } from "@/lib/money-input";

/**
 * A number field that reads like plain text while it's being typed into, and
 * like money once the person looks away.
 *
 * Reformatting on every keystroke would fight the person typing — the cursor
 * jumps, a trailing zero appears mid-digit — so the field shows the raw
 * number while focused, exactly like the native `type="number"` input it
 * replaces, and only switches to `formatMoney(...)` on blur. Because editing
 * is always plain-decimal, no locale-aware parsing of an already-formatted
 * string is ever needed — the only cleanup is stripping stray characters as
 * someone types (`sanitizeNumericInput`).
 *
 * The value a form actually posts never goes through the formatted display
 * string at all: it travels in a sibling hidden input carrying the clean
 * numeric string, the same way `RichTextEditor` posts its HTML. That keeps
 * `z.coerce.number()` on the other end untouched — it never has to parse a
 * currency symbol or a thousands separator back out.
 */
export function MoneyInput({
  name,
  id,
  value,
  defaultValue,
  onChange,
  currency,
  formatLocale,
  className,
  disabled,
  placeholder,
  "aria-label": ariaLabel,
}: {
  name: string;
  id?: string;
  /** Controlled: the raw numeric string, e.g. `"1234.5"`. */
  value?: string;
  defaultValue?: string;
  onChange?: (raw: string) => void;
  currency: string;
  formatLocale: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState(value ?? defaultValue ?? "");
  // What `raw` was last synced from, tracked in state rather than a ref:
  // React allows calling `setState` conditionally during render to mirror a
  // changed prop ("adjusting state when a prop changes"), but not reading or
  // writing a ref there.
  const [syncedFrom, setSyncedFrom] = useState(value);

  if (value !== undefined && value !== syncedFrom && !focused) {
    setSyncedFrom(value);
    setRaw(value);
  }

  function commit(next: string) {
    setRaw(next);
    setSyncedFrom(next);
    onChange?.(next);
  }

  const numeric = Number(raw);
  // Empty stays empty rather than displaying a formatted zero — an untouched
  // field shouldn't read as "$0.00 was typed in".
  const display =
    focused || raw === "" ? raw : formatMoney(Number.isFinite(numeric) ? numeric : 0, currency, formatLocale);

  return (
    <>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={display}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (value !== undefined && value !== syncedFrom) {
            setSyncedFrom(value);
            setRaw(value);
          }
        }}
        onChange={(event) => commit(sanitizeNumericInput(event.target.value))}
        disabled={disabled}
        className={className}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      <input type="hidden" name={name} value={raw} />
    </>
  );
}
