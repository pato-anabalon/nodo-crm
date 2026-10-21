"use client";

import { CardVariantSwitch, useCardVariant } from "@/components/ui/record-card";
import { QuoteCard, type QuoteCardData } from "./quote-card";

/**
 * The quotes on a phone: the choice of density, then the cards. It applies the
 * moment it is picked, since every card reads the same value.
 *
 * Phones only (`sm:hidden`); from 640px the page shows its table instead.
 */
export function QuoteCards({
  quotes,
  storageKey,
  empty,
}: {
  quotes: QuoteCardData[];
  storageKey: string;
  /** The "no quotes yet" line, written on the server. */
  empty: string;
}) {
  const [variant, setVariant] = useCardVariant(storageKey);

  return (
    <div className="space-y-3 sm:hidden">
      <CardVariantSwitch value={variant} onValueChange={setVariant} />

      {quotes.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className={variant === "balanced" ? "space-y-4" : "space-y-3"}>
          {quotes.map((quote) => (
            <li key={quote.id}>
              <QuoteCard quote={quote} variant={variant} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
