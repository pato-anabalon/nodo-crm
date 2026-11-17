type LeadLabelSource = {
  title: string;
  contactName?: string | null;
  companyName?: string | null;
};

/**
 * How a lead reads in a picker: the person first, then the job, then their
 * company. Several leads share a title ("Kitchen replaster"), and the person is
 * what someone searching for a lead remembers. Missing pieces drop out instead
 * of leaving stray " - " gaps.
 *
 * One function for the search results and for the option preselected when a
 * quote is opened, so the two can't read differently.
 */
export function leadOptionLabel(lead: LeadLabelSource): string {
  return [lead.contactName, lead.title, lead.companyName].filter(Boolean).join(" - ");
}
