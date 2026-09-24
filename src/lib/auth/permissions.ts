/**
 * Catalogue of features that can be assigned to profiles.
 *
 * This list is the source of truth: the `Permission` table is seeded from here
 * (`pnpm db:seed`). The readable names don't live here but in the message files,
 * under `permissions.<key>` and `permissionModules.<module>`, so each user reads
 * them in their own language.
 */

export const PERMISSION_MODULES = [
  "leads",
  "quotes",
  "contacts",
  "settings",
  "users",
  "roles",
  "reports",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSIONS = [
  // Leads
  "leads.read",
  "leads.create",
  "leads.update",
  "leads.delete",
  "leads.assign",
  "leads.read.all",

  // Quotes
  "quotes.read",
  "quotes.create",
  "quotes.update",
  "quotes.delete",
  "quotes.send",
  "quotes.decide",
  "quotes.read.all",

  // Contacts
  "contacts.read",
  "contacts.create",
  "contacts.update",
  "contacts.delete",

  // Company settings
  "settings.read",
  "settings.update",

  // Users
  "users.read",
  "users.invite",
  "users.update",
  "users.remove",

  // Profiles
  "roles.read",
  "roles.update",

  // Reports
  "reports.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS;

/** The module is the key's prefix: `leads.read` -> `leads`. */
export function permissionModule(permission: Permission): PermissionModule {
  return permission.split(".")[0] as PermissionModule;
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/** Groups the catalogue by module, for the profile assignment grid. */
export function permissionsByModule(): Record<PermissionModule, Permission[]> {
  const grouped = {} as Record<PermissionModule, Permission[]>;
  for (const name of PERMISSION_MODULES) grouped[name] = [];
  for (const permission of PERMISSIONS) grouped[permissionModule(permission)].push(permission);
  return grouped;
}

/**
 * A permission's message key.
 *
 * next-intl uses the dot as a namespace separator, so `leads.read` is stored in
 * the message files as `permissions.leads_read`.
 */
export function permissionMessageKey(permission: Permission): string {
  return permission.replaceAll(".", "_");
}
