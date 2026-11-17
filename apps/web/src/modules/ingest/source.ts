import { LeadSource } from "@/generated/prisma/enums";

/**
 * Where a web enquiry says it came from.
 *
 * The form can ask "how did you find us?" and send the answer as `source`. It is
 * a closed list on our side — the lead's source is one of the platform's, or
 * "Other" with one of the options the company set up — so the answer is matched
 * against those and never stored as typed. An answer nobody here offers is not
 * lost (the whole payload is kept on the submission), but it doesn't become a
 * source: a free-text field is how a list ends up with "gogle" and "Google " as
 * two entries. No answer, or one that matches nothing, is the website — which is
 * what the form was, whatever else was said about it.
 */

/** Compared without case, spaces, hyphens or underscores: "Cold call" = COLD_CALL. */
function squash(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

/** What a form is likely to call each of the platform's own sources. */
const BY_NAME: Record<string, LeadSource> = {
  web: LeadSource.WEB,
  website: LeadSource.WEB,
  referral: LeadSource.REFERRAL,
  campaign: LeadSource.CAMPAIGN,
  coldcall: LeadSource.COLD_CALL,
  event: LeadSource.EVENT,
  social: LeadSource.SOCIAL,
  socialmedia: LeadSource.SOCIAL,
  other: LeadSource.OTHER,
};

export function resolveIngestSource(
  answer: string | null,
  offered: readonly string[],
): { source: LeadSource; sourceDetail: string | null } {
  const website = { source: LeadSource.WEB, sourceDetail: null };
  if (!answer) return website;

  const wanted = squash(answer);
  const own = BY_NAME[wanted];
  if (own) return { source: own, sourceDetail: null };

  // The company's own label is kept as the company wrote it, whatever case or
  // spacing the form used.
  const label = offered.find((option) => squash(option) === wanted);
  if (label) return { source: LeadSource.OTHER, sourceDetail: label };

  return website;
}
