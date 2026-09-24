import { MembershipStatus, RoleKey } from "@/generated/prisma/enums";

export type MemberSnapshot = {
  userId: string;
  roleKey: RoleKey;
  status: MembershipStatus;
};

export type MemberChange =
  | { kind: "role"; to: RoleKey }
  | { kind: "suspend" }
  | { kind: "reactivate" }
  | { kind: "remove" };

/** Why a change to a member was refused, or `null` when it may go ahead. */
export type Refusal = "self" | "last-owner";

/**
 * Whether one person may change another's membership.
 *
 * Two things are being protected, and both are about locking people out rather
 * than about permissions — whoever gets this far already holds `users.update`.
 *
 * **Nobody edits their own membership.** An owner who demotes themselves to
 * viewer by mistake loses the very screen they would undo it from. Leaving a
 * company is a deliberate act and belongs elsewhere, not behind the same button
 * used to tidy up somebody else.
 *
 * **The last active owner stays an active owner.** Suspending, removing or
 * demoting them would leave a company nobody can administer, which no screen in
 * the product can recover from.
 */
export function refuseMemberChange(
  actorUserId: string,
  member: MemberSnapshot,
  change: MemberChange,
  activeOwners: number,
): Refusal | null {
  if (member.userId === actorUserId) return "self";

  if (!removesAnOwner(member, change)) return null;
  return activeOwners <= 1 ? "last-owner" : null;
}

/** Does this change take an active owner out of the company's administration? */
function removesAnOwner(member: MemberSnapshot, change: MemberChange): boolean {
  const isActiveOwner =
    member.roleKey === RoleKey.OWNER && member.status === MembershipStatus.ACTIVE;
  if (!isActiveOwner) return false;

  if (change.kind === "remove" || change.kind === "suspend") return true;
  if (change.kind === "role") return change.to !== RoleKey.OWNER;
  return false;
}

/**
 * Whether a profile's permissions may be edited.
 *
 * `OWNER` always holds everything: it is the profile that can undo any mistake
 * made on this very screen, so letting it be trimmed is how a company locks
 * itself out of its own settings.
 */
export function isRoleEditable(key: RoleKey): boolean {
  return key !== RoleKey.OWNER;
}
