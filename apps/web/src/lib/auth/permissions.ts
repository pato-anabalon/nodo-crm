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
  // Module Jobs: one module per tool, so the profile grid groups them that way
  // and a profile can be given the Schedule without the Chat.
  "jobs",
  "messages",
  "comments",
  "todos",
  "files",
  "schedule",
  "chat",
  "lineup",
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
  // Unlike the rest of the catalogue, this one hides a **datum** rather than
  // granting or withholding an action: without it, a quote a profile can
  // otherwise open still shows, but its priced figures don't.
  "quotes.read.amounts",
  // Takes data out of the platform, so no standard profile but `OWNER` (which
  // holds everything) starts with it: each company hands it to the profiles it
  // chooses. Without `quotes.read.amounts` the file simply has no amount columns.
  "quotes.export",

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

  // Jobs. Being a member of a job decides *where* somebody may act; these
  // decide *what* they may do there — being a member grants nothing by itself.
  // `jobs.read` is the jobs somebody is a member of; `jobs.read.all` is every one.
  "jobs.read",
  "jobs.read.all",
  "jobs.create",
  // Name, description, address, status.
  "jobs.update",
  // The job's start and end — its bar on the Lineup. Apart from `jobs.update`
  // because moving the plan is a different responsibility from fixing a typo.
  "jobs.dates",
  "jobs.members",
  // Closing a job locks it: nothing in it can be added, changed or deleted. Its
  // own pair, apart from `jobs.update`, because not everybody who may fix a
  // typo may end the work — and undoing it is a bigger step still.
  "jobs.finish",
  "jobs.reopen",
  "jobs.delete",
  // Edit and delete what **somebody else** wrote or uploaded. Without it,
  // `*.update` and `*.delete` on authored content reach only one's own.
  "jobs.moderate",

  // Message board
  "messages.read",
  "messages.create",
  "messages.update",
  "messages.delete",

  // Comments, on anything in a job that takes them
  "comments.create",
  "comments.update",
  "comments.delete",

  // To-dos. Ticking one off is not editing it: `todos.complete` lets somebody
  // mark work done without being able to move its dates or reassign it.
  "todos.read",
  "todos.create",
  "todos.update",
  "todos.complete",
  "todos.delete",

  // Docs & files
  "files.read",
  "files.create",
  "files.update",
  "files.delete",

  // Schedule. `schedule.update` includes moving an event's dates.
  "schedule.read",
  "schedule.create",
  "schedule.update",
  "schedule.delete",

  // Chat
  "chat.read",
  "chat.create",
  "chat.delete",

  // The calendar across every job somebody can see
  "lineup.read",
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
