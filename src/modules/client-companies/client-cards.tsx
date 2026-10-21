"use client";

import { CardVariantSwitch, useCardVariant } from "@/components/ui/record-card";
import { ClientCard, type ClientCardData } from "./client-card";

/** The customer companies on a phone; from 640px the page shows its table instead. */
export function ClientCards({
  clients,
  storageKey,
  empty,
}: {
  clients: ClientCardData[];
  storageKey: string;
  empty: string;
}) {
  const [variant, setVariant] = useCardVariant(storageKey);

  return (
    <div className="space-y-3 sm:hidden">
      <CardVariantSwitch value={variant} onValueChange={setVariant} />

      {clients.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className={variant === "balanced" ? "space-y-4" : "space-y-3"}>
          {clients.map((client) => (
            <li key={client.id}>
              <ClientCard client={client} variant={variant} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
