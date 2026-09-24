import { LeadSource, LeadStatus } from "@/generated/prisma/enums";

/**
 * The visible names for statuses and sources live in the message files
 * (`leads.status.*` and `leads.source.*`). Only order and meaning remain here.
 */
export const LEAD_SOURCES: readonly LeadSource[] = [
  LeadSource.WEB,
  LeadSource.REFERRAL,
  LeadSource.CAMPAIGN,
  LeadSource.COLD_CALL,
  LeadSource.EVENT,
  LeadSource.SOCIAL,
  LeadSource.OTHER,
];

/** Pipeline order, from the top of the funnel down. */
export const LEAD_PIPELINE: readonly LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
  LeadStatus.PROPOSAL,
  LeadStatus.NEGOTIATION,
  LeadStatus.WON,
  LeadStatus.LOST,
];

/** Statuses that close the lead: they no longer count as an open opportunity. */
export const CLOSED_LEAD_STATUSES: readonly LeadStatus[] = [LeadStatus.WON, LeadStatus.LOST];

export function isClosedStatus(status: LeadStatus): boolean {
  return CLOSED_LEAD_STATUSES.includes(status);
}

/** Badge colour according to how far along the lead is. */
export function leadStatusVariant(status: LeadStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === LeadStatus.WON) return "default";
  if (status === LeadStatus.LOST) return "destructive";
  if (status === LeadStatus.NEW) return "outline";
  return "secondary";
}

/**
 * What a quote's fate does to the lead it came from.
 *
 * The lead is the unit of work, not the person — that is what lets a customer
 * who comes back a year later arrive as a new lead while the won one keeps its
 * history. So these events move the work along its own funnel and never look at
 * who the customer is.
 */
export type LeadEvent = "quote-sent" | "quote-accepted" | "quotes-all-declined";

/**
 * The status a lead should move to, or `null` to leave it where it is.
 *
 * Two rules hold it together. It only ever moves **forward**: a second quote
 * going out to a lead already in negotiation must not drag it back to proposal.
 * And **won is the end**: nothing reopens a lead that was won, because its
 * history is what the reports are built on.
 *
 * Lost is not an end. A quote sent to a lost lead is someone reviving it, which
 * is the one case where moving back up the funnel is right.
 */
export function nextLeadStatus(current: LeadStatus, event: LeadEvent): LeadStatus | null {
  if (current === LeadStatus.WON) return null;

  if (event === "quote-accepted") return LeadStatus.WON;

  if (event === "quotes-all-declined") {
    return current === LeadStatus.LOST ? null : LeadStatus.LOST;
  }

  if (current === LeadStatus.LOST) return LeadStatus.PROPOSAL;

  const at = LEAD_PIPELINE.indexOf(current);
  const proposal = LEAD_PIPELINE.indexOf(LeadStatus.PROPOSAL);
  return at >= 0 && at < proposal ? LeadStatus.PROPOSAL : null;
}
