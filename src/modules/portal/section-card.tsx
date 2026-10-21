import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * A section as the customer reads it, shared by the static list and the
 * interactive selector so the two can't drift apart.
 *
 * Two arrangements of the same three parts — the heading, the price, and the
 * description with its files:
 *
 * - **A phone: one column, in the order somebody decides in.** Heading, then the
 *   price as a strip of its own, then the description. The price used to be a
 *   fifth of the card, beside the text, which on a phone squeezed the
 *   description into a narrow column and left the figure floating wherever the
 *   middle of a long scope happened to fall. A long description would also have
 *   pushed the price off the screen; here it is the second thing read.
 * - **From 640px: the heading and description on the left, the price in a
 *   column down the right**, spanning both, as it always was.
 *
 * Not a client component: it holds no state, and the static list renders it from
 * the server while the selector renders it from the browser.
 */
export function SectionCard({
  heading,
  price,
  tinted,
  children,
}: {
  heading: ReactNode;
  price: ReactNode;
  /** The price strip's wash — always for a fixed section, "included" for a choosable one. */
  tinted: boolean;
  /** The description and files. Omit when there is nothing to show. */
  children?: ReactNode;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--primary)_60%,transparent)] sm:grid sm:grid-cols-[80%_20%]">
      <div className={cn("min-w-0 p-4 sm:col-start-1 sm:row-start-1", children ? "sm:pb-0" : "")}>
        {heading}
      </div>

      {/* A column down the right at width, a strip under the heading on a phone.
          No rounding of its own: `overflow-hidden` on the article clips it to the
          shared outer radius. */}
      <div
        className={cn(
          "flex items-center justify-end px-4 py-2.5 transition-colors sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:px-3 sm:py-0",
          tinted && "bg-muted-foreground/10",
        )}
      >
        {price}
      </div>

      {children ? (
        <div className="min-w-0 space-y-3 p-4 sm:col-start-1 sm:row-start-2 sm:pt-3">{children}</div>
      ) : null}
    </article>
  );
}

/**
 * The figure, with its discount when the section has one. Takes text, not a
 * formatter: this is rendered from the server and from the browser, and a
 * function can't cross from one to the other.
 */
export function SectionPrice({
  gross,
  net,
  discountLabel,
}: {
  gross: string;
  net: string;
  /** "10% off" — present only when the section is discounted. */
  discountLabel: string | null;
}) {
  if (!discountLabel) {
    return <span className="text-lg font-medium tabular-nums">{net}</span>;
  }

  return (
    <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end sm:justify-center sm:gap-0.5 sm:py-2">
      <span className="flex flex-wrap items-baseline gap-x-2 sm:flex-col sm:items-end sm:gap-0.5">
        <span className="text-xs text-muted-foreground line-through">{gross}</span>
        <span className="text-xs font-semibold text-primary">{discountLabel}</span>
      </span>
      <span className="text-lg font-medium tabular-nums">{net}</span>
    </div>
  );
}
