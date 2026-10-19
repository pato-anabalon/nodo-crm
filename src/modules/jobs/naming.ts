/**
 * The name a job gets when it starts from a quote: `<address> - <reference>`.
 *
 * The reference is always there — it is how the job is told apart from the
 * next one at the same address, and how somebody gets from the job back to the
 * quote the customer holds. Without an address, the quote's title stands in
 * front of it.
 */
export function jobNameFromQuote(input: {
  projectAddress: string | null;
  title: string;
  reference: string;
}): string {
  const lead = clean(input.projectAddress) || clean(input.title);
  return lead ? `${lead} - ${input.reference}` : input.reference;
}

function clean(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
