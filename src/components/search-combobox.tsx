"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { cn } from "cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export type SearchComboboxItem = {
  id: string;
  label: string;
  description?: string | null;
};

/**
 * A single-select field that searches the server as you type, instead of
 * shipping every row to the browser up front. Built for the handful of
 * pickers in this app — linked lead, catalogue line, quote template — that
 * used to load their entire table into a plain `<select>`: fine at a dozen
 * rows, unusable once a company's history runs into the hundreds, and in the
 * lead picker's case actively broken — anything past the first page was
 * never reachable at all.
 *
 * Generic over the item shape so a caller can carry along whatever else it
 * needs for its own `onSelect` (the catalogue picker rides its unit price
 * and description here, to build a line item without a second lookup) — the
 * component itself only ever touches `id` and `label`.
 *
 * `search` is a Server Action, passed the same way `acceptAction`/
 * `declineAction` already cross into a client component elsewhere in this
 * app — the one kind of function a Server Component is allowed to hand a
 * client one.
 */
export function SearchCombobox<T extends SearchComboboxItem>({
  id,
  name,
  value,
  onSelect,
  search,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  noneLabel,
  disabled,
  "aria-label": ariaLabel,
  className,
}: {
  id?: string;
  /** When given, posts the chosen id through a sibling hidden input — same
   * pattern as `MoneyInput`/`RichTextEditor`, so the form stays an ordinary
   * form. Omitted for a picker that acts on selection instead of holding a
   * value (the catalogue and template pickers never post their own field). */
  name?: string;
  value: T | null;
  onSelect: (item: T | null) => void;
  search: (query: string) => Promise<T[]>;
  placeholder: string;
  searchPlaceholder?: string;
  emptyLabel: string;
  /** A pseudo-row at the top of the results that clears the selection —
   * offered only when the field is actually nullable. */
  noneLabel?: string;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  // The query `results` was actually fetched for — comparing it against the
  // debounced query gives "loading" for free, as a value derived during
  // render, rather than a second `setState` racing the one that updates
  // `results` itself.
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 250);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastRequest = useRef(0);
  const loading = open && fetchedFor !== debouncedQuery;

  useEffect(() => {
    if (!open) return;
    const requestId = ++lastRequest.current;
    search(debouncedQuery).then((items) => {
      if (lastRequest.current !== requestId) return; // a newer keystroke already won
      setResults(items);
      setFetchedFor(debouncedQuery);
      setHighlighted(0);
    });
  }, [open, debouncedQuery, search]);

  const rows: Array<{ id: string; label: string; item: T | null }> = [
    ...(noneLabel ? [{ id: "", label: noneLabel, item: null }] : []),
    ...results.map((item) => ({ id: item.id, label: item.label, item })),
  ];

  function choose(item: T | null) {
    onSelect(item);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((i) => Math.min(i + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[highlighted];
      if (row) choose(row.item);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      {name ? <input type="hidden" name={name} value={value?.id ?? ""} /> : null}
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-field px-3 py-1 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("min-w-0 truncate", !value && "text-muted-foreground")}>
            {value?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[28rem] max-w-[90vw] p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchInputRef.current?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlighted(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder ?? placeholder}
            className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
          {rows.length === 0 && !loading ? (
            <li className="px-2 py-4 text-center text-sm text-muted-foreground">{emptyLabel}</li>
          ) : null}
          {rows.map((row, index) => (
            <li key={row.id || "__none__"}>
              <button
                type="button"
                role="option"
                aria-selected={value?.id === row.item?.id}
                onClick={() => choose(row.item)}
                onMouseEnter={() => setHighlighted(index)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  highlighted === index
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{row.label}</span>
                  {row.item?.description ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.item.description}
                    </span>
                  ) : null}
                </span>
                {value?.id === row.item?.id ? <Check className="size-4 shrink-0" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
