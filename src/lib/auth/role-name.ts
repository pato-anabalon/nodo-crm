import type { RoleKey } from "@/generated/prisma/enums";

type Translator = (key: string) => string;

/**
 * A profile's display name.
 *
 * Standard profiles don't store their name in the database: it's translated from
 * the key. If a company renamed the profile, that text wins over the translation.
 */
export function roleDisplayName(
  role: { key: RoleKey | string; name?: string | null },
  t: Translator,
): string {
  if (role.name) return role.name;
  return t(`${role.key}.name`);
}

export function roleDescription(
  role: { key: RoleKey | string; description?: string | null },
  t: Translator,
): string {
  if (role.description) return role.description;
  return t(`${role.key}.description`);
}
