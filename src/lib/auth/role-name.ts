import type { RoleKey } from "@/generated/prisma/enums";

type Translator = (key: string) => string;

/**
 * A profile's display name.
 *
 * Standard profiles don't store their name in the database: it's translated from
 * the key. If a company renamed the profile, that text wins over the translation.
 */
export function roleDisplayName(
  role: { key: RoleKey | string | null; name?: string | null },
  t: Translator,
): string {
  if (role.name) return role.name;
  // A profile the company made always has a name; with neither there is nothing
  // to translate, and an empty label is better than asking for `null.name`.
  if (!role.key) return "";
  return t(`${role.key}.name`);
}

/**
 * Whether a name is already what another profile of this company is called, as
 * it appears on screen — the company's own wording or the translated standard
 * one, so a custom "Administrator" can't sit beside the standard "Administrator".
 * Case and surrounding space don't make a different name.
 */
export function isRoleNameTaken(
  roles: { id: string; key: RoleKey | string | null; name: string | null }[],
  name: string,
  t: Translator,
  exceptId?: string,
): boolean {
  const wanted = name.trim().toLowerCase();
  return roles.some((role) => role.id !== exceptId && roleDisplayName(role, t).trim().toLowerCase() === wanted);
}

export function roleDescription(
  role: { key: RoleKey | string | null; description?: string | null },
  t: Translator,
): string {
  if (role.description) return role.description;
  if (!role.key) return "";
  return t(`${role.key}.description`);
}
