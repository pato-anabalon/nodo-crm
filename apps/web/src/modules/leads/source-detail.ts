import { LeadSource } from "@/generated/prisma/enums";

/**
 * What a lead keeps as the detail of its source.
 *
 * Only "Other" has one, and only a value the company actually offers is kept: a
 * posted label comes from a form, and a hand-crafted post must not put its own
 * words in the company's list. The lead's current value is also accepted, so
 * saving an old lead whose option was since removed doesn't wipe what it was
 * recorded with. Anything else reads as none, the same as a stale `contactId`.
 */
export function resolveSourceDetail({
  source,
  detail,
  offered,
  current = null,
}: {
  source: LeadSource;
  detail: string | null | undefined;
  offered: readonly string[];
  current?: string | null;
}): string | null {
  if (source !== LeadSource.OTHER || !detail) return null;
  return offered.includes(detail) || detail === current ? detail : null;
}
