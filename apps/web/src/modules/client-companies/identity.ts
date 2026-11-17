/**
 * How a customer's company is recognised.
 *
 * On the name, because that is all a contact form collects — and a name is much
 * weaker evidence than the address that identifies a person. All this does is
 * stop the same spelling counting twice; "Scott Builders" and "Scott Builders
 * Ltd" remain two companies until somebody says otherwise.
 */

/**
 * The form of a name used for matching.
 *
 * Surrounding space goes, runs of space inside collapse to one, and case is
 * ignored — those are the differences between two people typing the same
 * company, not between two companies.
 */
export function normaliseCompanyName(name: string | null | undefined): string | null {
  const collapsed = (name ?? "").trim().replace(/\s+/g, " ");
  return collapsed === "" ? null : collapsed;
}

/** Whether two typed names should be treated as the same company. */
export function sameCompanyName(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normaliseCompanyName(a);
  const right = normaliseCompanyName(b);
  if (left === null || right === null) return false;
  return left.toLowerCase() === right.toLowerCase();
}
