import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/components/company-logo";
import { cn } from "@/lib/utils";

export type Person = { id: string; name: string | null; email: string; image: string | null };

export function personName(person: Pick<Person, "name" | "email">): string {
  return person.name?.trim() || person.email;
}

/**
 * A person's avatar. The colour behind the initials is derived from their id,
 * so the same person reads as the same colour on every job — which is how a
 * row of avatars becomes recognisable at a glance, as it is in Basecamp.
 */
export function PersonAvatar({
  person,
  size = "default",
  className,
}: {
  person: Person;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const name = personName(person);
  return (
    <Avatar size={size} className={className} title={name}>
      {person.image ? <AvatarImage src={person.image} alt={name} /> : null}
      <AvatarFallback className="text-[0.65rem] font-semibold text-white" style={{ backgroundColor: avatarColour(person.id) }}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Overlapping avatars, with the overflow counted rather than drawn. */
export function AvatarStack({ people, max = 8, className }: { people: Person[]; max?: number; className?: string }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {shown.map((person) => (
        <PersonAvatar key={person.id} person={person} size="sm" className="ring-2 ring-card" />
      ))}
      {rest > 0 ? (
        <span className="relative flex size-6 items-center justify-center rounded-full bg-muted text-[0.65rem] font-medium text-muted-foreground ring-2 ring-card">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A fixed, mid-lightness hue per person. White initials on these clear 4.5:1,
 * which a hue picked at random wouldn't promise.
 */
export function avatarColour(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return `oklch(0.5 0.13 ${hue})`;
}
