"use client";

import { CardVariantSwitch, useCardVariant } from "@/components/ui/record-card";
import { LeadCard, type LeadCardData } from "./lead-card";

/** The leads on a phone; from 640px the page shows its table instead. */
export function LeadCards({
  leads,
  storageKey,
  empty,
}: {
  leads: LeadCardData[];
  storageKey: string;
  empty: string;
}) {
  const [variant, setVariant] = useCardVariant(storageKey);

  return (
    <div className="space-y-3 sm:hidden">
      <CardVariantSwitch value={variant} onValueChange={setVariant} />

      {leads.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className={variant === "balanced" ? "space-y-4" : "space-y-3"}>
          {leads.map((lead) => (
            <li key={lead.id}>
              <LeadCard lead={lead} variant={variant} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
