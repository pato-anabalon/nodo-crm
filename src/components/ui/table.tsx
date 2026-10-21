"use client"

import * as React from "react"
import { cn } from "cn"
import { Card } from "@/components/ui/card"

/**
 * A card that holds nothing but a table.
 *
 * `Card` pads itself vertically, which is right when it has a header and wrong
 * when the table is the whole card: the four listings said `p-0` on the content
 * and still got 24px of empty band above and below, because that padding was
 * never the content's.
 *
 * `overflow-hidden` matters too — without it the header band squares off the
 * corners the card just rounded.
 *
 * A component rather than a class string, because that string was already
 * written four times and the fifth is how they drift apart.
 */
function TableCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return <Card className={cn("gap-0 overflow-hidden py-0", className)} {...props} />;
}

/**
 * `cards` turns the table into a list of cards below 640px.
 *
 * A table with more columns than a phone has width either hides some behind a
 * sideways swipe — which nobody discovers, and which a sticky first column only
 * half fixes — or squeezes every one into a few characters. Cards show every
 * value, each row as one card: the cell marked `primary` is its title and every
 * other cell is a `label: value` line. The rules are in `globals.css`, keyed on
 * `data-cards`, so a screen opts in with this one prop and labels its cells.
 *
 * Not on by default: a table of two short columns is fine as it is.
 */
function Table({
  className,
  cards = false,
  ...props
}: React.ComponentProps<"table"> & { cards?: boolean }) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        data-cards={cards ? "" : undefined}
        className={cn("w-full caption-bottom text-sm [&_tbody_td]:border-t [&_tbody_td]:border-border", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        // The header stops competing with the rows: a tinted band, smaller,
        // spaced and quiet. It used to be the same size and weight as the data,
        // so it read as one more row.
        "bg-field [&_tr]:border-b [&_th]:text-xs [&_th]:font-normal [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(
        // Rows answer the pointer, because they can be opened.
        // The hover has to live *inside* the selector: `hover:[&_tr]` reads as
        // "when the tbody is hovered, paint every row", which lit the whole grid
        // from any cell.
        "[&_tr:last-child]:border-0 [&_tr]:transition-colors [&_tr:hover]:bg-foreground/[0.03]", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-9 px-4 text-left align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

/**
 * In a `cards` table, `label` is what the value is called on the card — the
 * column's header, which is hidden there — and `primary` makes the cell the
 * card's title, with no label. `actions` is the row's menu: it sits in the
 * card's top corner instead of taking a line of its own. All three are ignored
 * when it is a table.
 */
function TableCell({
  className,
  label,
  primary = false,
  actions = false,
  ...props
}: React.ComponentProps<"td"> & { label?: string; primary?: boolean; actions?: boolean }) {
  return (
    <td
      data-slot="table-cell"
      data-label={label}
      data-primary={primary ? "" : undefined}
      data-actions={actions ? "" : undefined}
      className={cn(
        "px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCard,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
}
