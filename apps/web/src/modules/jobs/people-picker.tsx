"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AvatarStack, PersonAvatar, personName, type Person } from "./avatars";

/**
 * People on the job, picked from a menu: who a to-do is for, who takes part in
 * an event. Ticked in place; what is ticked travels with the form as hidden
 * fields named `name`, since the menu's own items are gone from the page once
 * it closes.
 */
export function PeoplePicker({
  name,
  label,
  emptyLabel,
  people,
  defaultIds = [],
}: {
  name: string;
  label: string;
  emptyLabel: string;
  people: Person[];
  defaultIds?: string[];
}) {
  const t = useTranslations("jobs.todos");
  const [chosen, setChosen] = useState<string[]>(defaultIds);
  const picked = people.filter((person) => chosen.includes(person.id));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {chosen.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="h-auto min-h-9 w-full justify-start gap-2 font-normal sm:w-auto">
            {picked.length > 0 ? (
              <>
                <AvatarStack people={picked} max={5} />
                <span className="truncate">{picked.map(personName).join(", ")}</span>
              </>
            ) : (
              <>
                <UserPlus className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">{emptyLabel}</span>
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
          {people.length === 0 ? (
            <p className="px-2 py-1.5 text-sm italic text-muted-foreground">{t("nobodyOnJob")}</p>
          ) : (
            people.map((person) => (
              <DropdownMenuCheckboxItem
                key={person.id}
                checked={chosen.includes(person.id)}
                // Stay open: assigning three people is three ticks, not three trips.
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) =>
                  setChosen((current) =>
                    checked ? [...current, person.id] : current.filter((id) => id !== person.id),
                  )
                }
              >
                <PersonAvatar person={person} size="sm" />
                <span className="truncate">{personName(person)}</span>
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
