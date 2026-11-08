import { normaliseCompanyName } from "./identity";

/** The slice of Prisma this needs, so it can run inside the ingest transaction. */
type ClientCompanyWriter = {
  clientCompany: {
    findFirst(args: {
      where: { companyId: string; name: { equals: string; mode: "insensitive" } };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: { companyId: string; name: string };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
};

/**
 * Finds the customer's company behind an enquiry, or records it for the first
 * time.
 *
 * Matched on the name, ignoring case and spacing. That is weaker than the
 * address a person is matched on, and it is meant to be: the point is only to
 * stop one spelling counting twice, not to guess that two names are the same
 * business.
 *
 * Returns `null` when the form carried no company, and the lead keeps whatever
 * it arrived with.
 */
export async function attachClientCompany(
  tx: ClientCompanyWriter,
  companyId: string,
  name: string | null | undefined,
): Promise<string | null> {
  const clean = normaliseCompanyName(name);
  if (clean === null) return null;

  const existing = await tx.clientCompany.findFirst({
    where: { companyId, name: { equals: clean, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.clientCompany.create({
    data: { companyId, name: clean },
    select: { id: true },
  });

  return created.id;
}
