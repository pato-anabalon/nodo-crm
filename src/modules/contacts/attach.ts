import { canBecomeContact, normaliseEmail, splitPersonName } from "./identity";

/**
 * The slice of Prisma this needs, so it can run inside the ingest transaction.
 *
 * Typed structurally rather than as the client: the lead and the contact have to
 * be written in the same transaction, and the caller already holds `tx`.
 */
type ContactWriter = {
  contact: {
    findFirst(args: {
      where: { companyId: string; email: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: {
        companyId: string;
        firstName: string;
        lastName: string | null;
        email: string;
        phone: string | null;
        clientCompanyId: string | null;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
};

/**
 * Finds the person a web enquiry came from, or records them for the first time.
 *
 * This is what makes a customer who comes back a year later land on the same
 * record instead of a second one — the point of keeping the lead as the work and
 * the contact as the person.
 *
 * Matching is on the address alone. A name is far too weak on its own: two
 * "J. Smith" enquiries are not evidence of the same person, and merging them
 * would put one customer's history on another's record.
 *
 * Returns `null` when there is nothing solid to go on, and the lead simply keeps
 * the details it arrived with until somebody links it by hand.
 */
export async function attachContact(
  tx: ContactWriter,
  companyId: string,
  lead: { contactName: string | null; contactEmail: string | null; contactPhone?: string | null },
  clientCompanyId: string | null = null,
): Promise<string | null> {
  if (!canBecomeContact(lead)) return null;

  const email = normaliseEmail(lead.contactEmail)!;

  const existing = await tx.contact.findFirst({
    where: { companyId, email },
    select: { id: true },
  });
  if (existing) return existing.id;

  const { firstName, lastName } = splitPersonName(lead.contactName ?? "");

  const created = await tx.contact.create({
    data: {
      companyId,
      firstName,
      lastName,
      email,
      phone: lead.contactPhone ?? null,
      clientCompanyId,
    },
    select: { id: true },
  });

  return created.id;
}
