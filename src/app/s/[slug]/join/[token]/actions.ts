"use server";

import { acceptInvitationWithPassword, type AcceptWithPasswordOutcome } from "@/modules/team/service";

export type JoinOutcome = AcceptWithPasswordOutcome;

/**
 * Accepts an invitation and sets up the account in one step — see the
 * comment on `acceptInvitationWithPassword` for why no magic-link round trip
 * is needed here, and for why the password policy only applies to a new
 * password rather than one already on file.
 */
export async function acceptWithPassword(token: string, password: string): Promise<JoinOutcome> {
  return acceptInvitationWithPassword(token, password);
}
