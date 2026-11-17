import type { CompanyChoice } from "./types";

/**
 * Which company the app opens in: the one last chosen if this person can still
 * work there, the only one if there is just one, and otherwise none — they
 * choose. A membership can end between two openings, which is why the stored
 * slug is checked against the list rather than trusted.
 */
export function pickCompany(companies: CompanyChoice[], stored: string | null): string | null {
  if (stored && companies.some((company) => company.slug === stored)) return stored;
  return companies.length === 1 ? companies[0].slug : null;
}
