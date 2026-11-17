import { Image } from "expo-image";
import { Text, View } from "react-native";
import type { Person } from "@/lib/types";

/** A person's name as the web shows it: the name, or the address before the @. */
export function personName(person: Pick<Person, "name" | "email"> | null | undefined, fallback = ""): string {
  if (!person) return fallback;
  return person.name?.trim() || person.email.split("@")[0];
}

function initials(person: Pick<Person, "name" | "email">): string {
  return personName(person)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export function Avatar({ person, size = 28 }: { person: Person; size?: number }) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (person.image) return <Image source={person.image} style={box} accessibilityLabel={personName(person)} />;
  return (
    <View style={box} accessibilityLabel={personName(person)} className="items-center justify-center bg-secondary">
      <Text style={{ fontSize: size * 0.4 }} className="font-semibold text-secondary-foreground">
        {initials(person)}
      </Text>
    </View>
  );
}

/** Overlapping, at most `max`, and the rest as a count — the same as the web's stack. */
export function AvatarStack({ people, max = 3, size = 24 }: { people: Person[]; max?: number; size?: number }) {
  if (people.length === 0) return null;
  const rest = people.length - max;
  return (
    <View className="flex-row items-center" accessibilityLabel={people.map((person) => personName(person)).join(", ")}>
      {people.slice(0, max).map((person, index) => (
        <View key={person.id} style={{ marginLeft: index ? -size / 4 : 0 }} className="rounded-full border-2 border-card">
          <Avatar person={person} size={size} />
        </View>
      ))}
      {rest > 0 ? <Text className="ml-1 text-caption text-muted-foreground">+{rest}</Text> : null}
    </View>
  );
}
