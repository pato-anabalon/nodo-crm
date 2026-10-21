"use client";

import { CardVariantSwitch, useCardVariant } from "@/components/ui/record-card";
import { ContactCard, type ContactCardData } from "./contact-card";

/** The contacts on a phone; from 640px the page shows its table instead. */
export function ContactCards({
  contacts,
  storageKey,
  empty,
}: {
  contacts: ContactCardData[];
  storageKey: string;
  empty: string;
}) {
  const [variant, setVariant] = useCardVariant(storageKey);

  return (
    <div className="space-y-3 sm:hidden">
      <CardVariantSwitch value={variant} onValueChange={setVariant} />

      {contacts.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className={variant === "balanced" ? "space-y-4" : "space-y-3"}>
          {contacts.map((contact) => (
            <li key={contact.id}>
              <ContactCard contact={contact} variant={variant} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
