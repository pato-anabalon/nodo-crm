import { RoleKey } from "@/generated/prisma/enums";
import { ALL_PERMISSIONS, type Permission } from "./permissions";

/**
 * Templates for the standard profiles.
 *
 * When a company is created they're materialised as its own `Role` rows, so each
 * company can reassign features without affecting the others.
 *
 * The name and description aren't here: they're translated from `key` with
 * `roles.<KEY>.name` and `roles.<KEY>.description`. In the database they stay
 * null and are only filled in if a company renames a profile.
 */
export type RoleTemplate = {
  key: RoleKey;
  permissions: readonly Permission[] | "all";
};

export const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    key: RoleKey.OWNER,
    permissions: "all",
  },
  {
    key: RoleKey.ADMIN,
    permissions: [
      "leads.read", "leads.create", "leads.update", "leads.delete", "leads.assign", "leads.read.all",
      "quotes.read", "quotes.create", "quotes.update", "quotes.delete", "quotes.send", "quotes.decide", "quotes.read.all", "quotes.read.amounts",
      "contacts.read", "contacts.create", "contacts.update", "contacts.delete",
      "settings.read", "settings.update",
      "users.read", "users.invite", "users.update", "users.remove",
      "roles.read", "roles.update",
      "reports.read",
    ],
  },
  {
    key: RoleKey.MANAGER,
    permissions: [
      "leads.read", "leads.create", "leads.update", "leads.delete", "leads.assign", "leads.read.all",
      "quotes.read", "quotes.create", "quotes.update", "quotes.delete", "quotes.send", "quotes.decide", "quotes.read.all", "quotes.read.amounts",
      "contacts.read", "contacts.create", "contacts.update",
      "users.read",
      "reports.read",
    ],
  },
  {
    key: RoleKey.SALES,
    permissions: [
      "leads.read", "leads.create", "leads.update",
      "quotes.read", "quotes.create", "quotes.update", "quotes.send", "quotes.read.amounts",
      "contacts.read", "contacts.create", "contacts.update",
    ],
  },
  {
    key: RoleKey.VIEWER,
    permissions: [
      "leads.read", "leads.read.all",
      "quotes.read", "quotes.read.all", "quotes.read.amounts",
      "contacts.read",
      "reports.read",
    ],
  },
] as const;

export function templatePermissions(template: RoleTemplate): Permission[] {
  return template.permissions === "all" ? [...ALL_PERMISSIONS] : [...template.permissions];
}

export function roleTemplate(key: RoleKey): RoleTemplate {
  const found = ROLE_TEMPLATES.find((t) => t.key === key);
  if (!found) throw new Error(`No profile template exists for ${key}`);
  return found;
}
