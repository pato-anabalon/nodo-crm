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

/** Every tool in a job, in full — what the people running the work get. */
const JOB_TOOLS_ALL: readonly Permission[] = [
  "messages.read", "messages.create", "messages.update", "messages.delete",
  "comments.create", "comments.update", "comments.delete",
  "todos.read", "todos.create", "todos.update", "todos.complete", "todos.delete",
  "files.read", "files.create", "files.update", "files.delete",
  "schedule.read", "schedule.create", "schedule.update", "schedule.delete",
  "chat.read", "chat.create", "chat.delete",
  "lineup.read",
];

/** Reading every tool and writing nothing. */
const JOB_TOOLS_READ: readonly Permission[] = [
  "messages.read", "todos.read", "files.read", "schedule.read", "lineup.read",
];

const JOBS_ALL: readonly Permission[] = [
  "jobs.read", "jobs.read.all", "jobs.create", "jobs.update", "jobs.dates", "jobs.members", "jobs.finish", "jobs.reopen", "jobs.delete", "jobs.moderate",
];

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
      ...JOBS_ALL,
      ...JOB_TOOLS_ALL,
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
      ...JOBS_ALL,
      ...JOB_TOOLS_ALL,
    ],
  },
  {
    key: RoleKey.SALES,
    permissions: [
      "leads.read", "leads.create", "leads.update",
      "quotes.read", "quotes.create", "quotes.update", "quotes.send", "quotes.read.amounts",
      "contacts.read", "contacts.create", "contacts.update",
      "jobs.read",
      ...JOB_TOOLS_READ,
    ],
  },
  {
    key: RoleKey.VIEWER,
    permissions: [
      "leads.read", "leads.read.all",
      "quotes.read", "quotes.read.all", "quotes.read.amounts",
      "contacts.read",
      "reports.read",
      "jobs.read", "jobs.read.all",
      ...JOB_TOOLS_READ,
      "chat.read",
    ],
  },
  // The four below carry out the work. None of them reaches leads, quotes,
  // contacts or reports: a job links to its quote only for a profile that has
  // `quotes.read`.
  {
    // Runs a job end to end: opens it, puts the team together, sets the dates.
    key: RoleKey.PROJECT_LEAD,
    permissions: [
      "jobs.read", "jobs.read.all", "jobs.create", "jobs.update", "jobs.dates", "jobs.members", "jobs.finish", "jobs.moderate",
      ...JOB_TOOLS_ALL,
    ],
  },
  {
    // Leads a crew on site: organises the to-dos and the schedule of their jobs,
    // without moving the job's own dates or deciding who is on it.
    key: RoleKey.TEAM_LEAD,
    permissions: [
      "jobs.read",
      "messages.read", "messages.create", "messages.update", "messages.delete",
      "comments.create", "comments.update", "comments.delete",
      "todos.read", "todos.create", "todos.update", "todos.complete",
      "files.read", "files.create", "files.update", "files.delete",
      "schedule.read", "schedule.create", "schedule.update",
      "chat.read", "chat.create", "chat.delete",
      "lineup.read",
    ],
  },
  {
    // Does the work: reports progress, uploads photos, ticks off what is done.
    key: RoleKey.WORKER,
    permissions: [
      "jobs.read",
      "messages.read", "messages.create", "messages.update", "messages.delete",
      "comments.create", "comments.update", "comments.delete",
      "todos.read", "todos.create", "todos.complete",
      "files.read", "files.create", "files.update", "files.delete",
      "schedule.read",
      "chat.read", "chat.create", "chat.delete",
      "lineup.read",
    ],
  },
  {
    // From outside the company: reads, comments and contributes files, without
    // touching the plan.
    key: RoleKey.COLLABORATOR,
    permissions: [
      "jobs.read",
      "messages.read",
      "comments.create", "comments.update", "comments.delete",
      "todos.read", "todos.complete",
      "files.read", "files.create",
      "schedule.read",
      "chat.read", "chat.create",
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
